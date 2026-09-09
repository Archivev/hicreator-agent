import { readFile } from "node:fs/promises";
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
import {
  readMaskedSecret,
  resolveSetupConnection,
} from "./setup-flow.js";

const packageVersion = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
).version;

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
    const configurations = result.clients
      .map((client) => `- ${client}: ${result.configPaths[client]}`)
      .join("\n");
    process.stdout.write([
      `hiCreator ${result.version} is ready.`,
      result.verified
        ? `MCP tools: ${result.toolCount} verified.`
        : "MCP tools: verification skipped.",
      "Configured clients:",
      configurations,
      "",
    ].join("\n"));
  }
}

export async function setup(options = {}) {
  const home = options.home ?? homedir();
  const output = options.output ?? process.stderr;
  const report = options.report ?? ((message) => output.write(`${message}\n`));
  report("[1/5] Detecting supported clients...");
  const clients = options.clients
    ?? await detectClients(options.pathValue);
  if (clients.length === 0) {
    throw new Error(
      `No supported client found. Install one of: ${SUPPORTED_CLIENTS.join(", ")}.`,
    );
  }
  report(`[ok] Found: ${clients.join(", ")}.`);

  report("[2/5] Reading the API Key...");
  const mcpUrl = validateMcpUrl(options.mcpUrl ?? DEFAULT_MCP_URL);
  const suppliedApiKey = options.apiKey ?? process.env.HICREATOR_API_KEY;
  const prompt = suppliedApiKey === undefined
    ? ({ attempt, maxAttempts }) => readMaskedSecret({
        input: options.input ?? process.stdin,
        output,
        label: attempt === 1
          ? "hiCreator API Key: "
          : `hiCreator API Key (${attempt}/${maxAttempts}): `,
      })
    : undefined;
  const { apiKey, connection } = await resolveSetupConnection({
    initialApiKey: suppliedApiKey,
    prompt: options.prompt ?? prompt,
    verify: options.verify ?? ((value) => verifyMcp(mcpUrl, value, {
      clientVersion: packageVersion,
    })),
    report,
    sleep: options.sleep,
    skipVerify: options.skipVerify,
  });
  if (options.skipVerify) report("[3/5] MCP connection verification skipped.");

  report("[4/5] Installing the hiCreator Skill...");
  const skill = await syncSkill({ home, clients });
  report(`[ok] Skill ${skill.updated ? "installed or updated" : "is already current"} (${skill.version}).`);

  report("[5/5] Configuring clients...");
  const configPaths = await configureClients({
    home,
    clients,
    apiKey,
    mcpUrl,
  });
  report(`[ok] Configured: ${clients.join(", ")}.`);
  return {
    ...skill,
    clients,
    configPaths,
    mcpUrl,
    toolCount: connection?.tools.length ?? 0,
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
