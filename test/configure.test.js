import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { configureClients } from "../src/configure.js";

test("merges all client configs and safely updates its managed entries", async () => {
  const home = await mkdtemp(join(tmpdir(), "hicreator-agent-config-"));
  await writeFile(join(home, ".claude.json"), JSON.stringify({
    theme: "dark",
    mcpServers: { existing: { command: "existing" } },
  }));

  const first = await configureClients({
    home,
    clients: ["codex", "claude", "cursor"],
    apiKey: "hc_first_key_long_enough",
    mcpUrl: "https://mcp.example.com/mcp",
  });
  assert.deepEqual(Object.keys(first), ["codex", "claude", "cursor"]);

  const codex = await readFile(join(home, ".codex", "config.toml"), "utf8");
  assert.match(codex, /\[mcp_servers\.hicreator\]/u);
  assert.match(codex, /Authorization = "Bearer hc_first_key_long_enough"/u);
  const claude = JSON.parse(await readFile(join(home, ".claude.json"), "utf8"));
  assert.equal(claude.theme, "dark");
  assert.deepEqual(claude.mcpServers.existing, { command: "existing" });
  assert.equal(claude.mcpServers.hicreator.type, "http");
  const cursor = JSON.parse(
    await readFile(join(home, ".cursor", "mcp.json"), "utf8"),
  );
  assert.equal(cursor.mcpServers.hicreator.url, "https://mcp.example.com/mcp");

  await configureClients({
    home,
    clients: ["codex", "claude", "cursor"],
    apiKey: "hc_second_key_long_enough",
    mcpUrl: "https://mcp.example.com/v2/mcp",
  });
  const updatedCodex = await readFile(
    join(home, ".codex", "config.toml"),
    "utf8",
  );
  assert.equal(updatedCodex.match(/\[mcp_servers\.hicreator\]/gu)?.length, 1);
  assert.doesNotMatch(updatedCodex, /hc_first_key/u);
  assert.match(updatedCodex, /hc_second_key/u);

  for (const path of [
    join(home, ".codex", "config.toml"),
    join(home, ".claude.json"),
    join(home, ".cursor", "mcp.json"),
  ]) {
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  }
});

test("does not overwrite an unmanaged Codex server with the same name", async () => {
  const home = await mkdtemp(join(tmpdir(), "hicreator-agent-conflict-"));
  const codexDir = join(home, ".codex");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(codexDir, { recursive: true });
  await writeFile(
    join(codexDir, "config.toml"),
    "[mcp_servers.hicreator]\nurl = \"https://old.example.com/mcp\"\n",
  );

  await assert.rejects(() => configureClients({
    home,
    clients: ["codex"],
    apiKey: "hc_test_key_long_enough",
    mcpUrl: "https://mcp.example.com/mcp",
  }), /unmanaged hicreator MCP/u);
});
