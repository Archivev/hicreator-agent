import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter, join } from "node:path";

import { SERVER_NAME, SUPPORTED_CLIENTS } from "./constants.js";
import { readJson, writeFileAtomic, writeJsonAtomic } from "./files.js";

const CODEX_BLOCK_START = "# BEGIN hicreator-agent managed MCP";
const CODEX_BLOCK_END = "# END hicreator-agent managed MCP";

function tomlString(value) {
  return JSON.stringify(value);
}

async function configureCodex(home, apiKey, mcpUrl) {
  const path = join(home, ".codex", "config.toml");
  const existing = await readFile(path, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  const managedPattern = new RegExp(
    `\\n?${CODEX_BLOCK_START}[\\s\\S]*?${CODEX_BLOCK_END}\\n?`,
    "g",
  );
  const withoutManaged = existing.replace(managedPattern, "\n").trimEnd();
  if (/^\[mcp_servers\.(?:hicreator|"hicreator")\]/mu.test(withoutManaged)) {
    throw new Error(
      "Codex already has an unmanaged hicreator MCP entry. Remove it and run setup again.",
    );
  }
  const block = [
    CODEX_BLOCK_START,
    `[mcp_servers.${SERVER_NAME}]`,
    `url = ${tomlString(mcpUrl)}`,
    `http_headers = { Authorization = ${tomlString(`Bearer ${apiKey}`)} }`,
    "enabled = true",
    CODEX_BLOCK_END,
  ].join("\n");
  await writeFileAtomic(
    path,
    `${withoutManaged ? `${withoutManaged}\n\n` : ""}${block}\n`,
  );
  return path;
}

async function configureClaude(home, apiKey, mcpUrl) {
  const path = join(home, ".claude.json");
  const config = await readJson(path, {});
  config.mcpServers = {
    ...(config.mcpServers ?? {}),
    [SERVER_NAME]: {
      type: "http",
      url: mcpUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  };
  await writeJsonAtomic(path, config);
  return path;
}

async function configureCursor(home, apiKey, mcpUrl) {
  const path = join(home, ".cursor", "mcp.json");
  const config = await readJson(path, {});
  config.mcpServers = {
    ...(config.mcpServers ?? {}),
    [SERVER_NAME]: {
      url: mcpUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  };
  await writeJsonAtomic(path, config);
  return path;
}

const configurators = {
  codex: configureCodex,
  claude: configureClaude,
  cursor: configureCursor,
};

export async function configureClients({ home, clients, apiKey, mcpUrl }) {
  const paths = {};
  for (const client of clients) {
    paths[client] = await configurators[client](home, apiKey, mcpUrl);
  }
  return paths;
}

async function executableExists(command, pathValue = process.env.PATH ?? "") {
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    try {
      await access(join(directory, command), fsConstants.X_OK);
      return true;
    } catch {
      // Continue through PATH entries.
    }
  }
  return false;
}

export async function detectClients(pathValue) {
  const detected = [];
  for (const client of SUPPORTED_CLIENTS) {
    if (await executableExists(client, pathValue)) detected.push(client);
  }
  return detected;
}

export function parseClients(value) {
  if (value === "all") return [...SUPPORTED_CLIENTS];
  const clients = [...new Set(value.split(",").map((item) => item.trim())
    .filter(Boolean))];
  const unsupported = clients.filter((client) =>
    !SUPPORTED_CLIENTS.includes(client));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported clients: ${unsupported.join(", ")}`);
  }
  return clients;
}
