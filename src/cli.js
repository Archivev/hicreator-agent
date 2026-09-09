import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { homedir } from "node:os";

import {
  DEFAULT_MCP_URL,
  SUPPORTED_CLIENTS,
} from "./constants.js";
import {
  configureClients,
  detectClients,
  parseClients,
} from "./configure.js";
import { installedClients, syncSkill } from "./install-skill.js";
import { verifyMcp } from "./mcp-check.js";

function parseOptions(argv) {
  const [command, ...rest] = argv;
  const options = { command, json: false, skipVerify: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--skip-verify") options.skipVerify = true;
    else if (argument === "--clients" || argument === "--mcp-url") {
      const value = rest[index + 1];
      if (!value) throw new Error(`${argument} requires a value.`);
      options[argument === "--clients" ? "clients" : "mcpUrl"] = value;
      index += 1;
    } else if (argument === "--api-key" || argument?.startsWith("--api-key=")) {
      throw new Error("Do not pass API keys as command arguments.");
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

async function promptForApiKey() {
  if (!process.stdin.isTTY) {
    throw new Error(
      "Set HICREATOR_API_KEY or run setup in an interactive terminal.",
    );
  }
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stderr.write(chunk, encoding);
      callback();
    },
  });
  const readline = createInterface({ input: process.stdin, output, terminal: true });
  const answerPromise = readline.question("hiCreator API key: ");
  muted = true;
  const answer = await answerPromise;
  muted = false;
  process.stderr.write("\n");
  readline.close();
  return answer;
}

function validateApiKey(value) {
  const apiKey = value?.trim();
  if (!/^hc_[A-Za-z0-9_-]{17,253}$/u.test(apiKey ?? "")) {
    throw new Error("Enter a valid hiCreator Developer API key.");
  }
  return apiKey;
}

function validateMcpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid MCP URL.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("The MCP URL must use HTTPS unless it targets localhost.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("The MCP URL cannot contain credentials or a fragment.");
  }
  return url.href;
}

function printResult(result, json) {
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    process.stdout.write(
      `hiCreator ${result.version} ready for ${result.clients.join(", ")}.\n`,
    );
  }
}

export async function setup(options = {}) {
  const home = options.home ?? homedir();
  const clients = options.clients
    ?? await detectClients(options.pathValue);
  if (clients.length === 0) {
    throw new Error(
      `No supported client found. Install one of: ${SUPPORTED_CLIENTS.join(", ")}.`,
    );
  }
  const apiKey = validateApiKey(
    options.apiKey ?? process.env.HICREATOR_API_KEY ?? await promptForApiKey(),
  );
  const mcpUrl = validateMcpUrl(options.mcpUrl ?? DEFAULT_MCP_URL);
  const connection = options.skipVerify
    ? null
    : await verifyMcp(mcpUrl, apiKey);
  const skill = await syncSkill({ home, clients });
  const configPaths = await configureClients({
    home,
    clients,
    apiKey,
    mcpUrl,
  });
  return {
    ...skill,
    clients,
    configPaths,
    mcpUrl,
    verified: Boolean(connection),
  };
}

export async function prepare(options = {}) {
  const home = options.home ?? homedir();
  const clients = options.clients ?? await installedClients(home);
  if (clients.length === 0) {
    throw new Error("hiCreator is not installed. Run setup first.");
  }
  return syncSkill({ home, clients });
}

export async function runCli(argv) {
  try {
    const options = parseOptions(argv);
    if (options.command === "setup") {
      const result = await setup({
        clients: options.clients ? parseClients(options.clients) : undefined,
        mcpUrl: options.mcpUrl,
        skipVerify: options.skipVerify,
      });
      printResult(result, options.json);
      return;
    }
    if (options.command === "prepare") {
      const result = await prepare();
      printResult({ ...result, clients: Object.keys(result.targets) }, options.json);
      return;
    }
    throw new Error(
      "Usage: hicreator-agent <setup|prepare> [--clients codex,claude,cursor] [--json]",
    );
  } catch (error) {
    process.stderr.write(`hicreator-agent: ${error.message}\n`);
    process.exitCode = 1;
  }
}
