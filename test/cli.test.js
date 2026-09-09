import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { setup } from "../src/cli.js";
import { McpConnectionError } from "../src/mcp-check.js";

test("does not write Skill or client configuration before verification", async () => {
  const home = await mkdtemp(join(tmpdir(), "hicreator-agent-no-write-"));
  await assert.rejects(() => setup({
    home,
    clients: ["codex"],
    apiKey: "hc_rejected_key_long_enough",
    verify: async () => {
      throw new McpConnectionError("The API Key was rejected (HTTP 401).", {
        kind: "auth",
        status: 401,
      });
    },
    report: () => {},
  }), /rejected/u);

  await assert.rejects(
    () => readFile(join(home, ".codex", "config.toml")),
    { code: "ENOENT" },
  );
  await assert.rejects(
    () => readFile(join(home, ".codex", "skills", "hicreator", "SKILL.md")),
    { code: "ENOENT" },
  );
});
