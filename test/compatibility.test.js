import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { setup, prepare } from "../src/cli.js";
import { configureClients, detectClients, parseClients } from "../src/configure.js";
import { pathExists, readJson } from "../src/files.js";
import { readMaskedSecret, resolveSetupConnection } from "../src/setup-flow.js";
import { McpConnectionError } from "../src/mcp-check.js";

const runFile = promisify(execFile);
const fakeKey = "hc_isolated_test_key_not_a_real_credential";
async function temporaryHome(t) {
  const home = await mkdtemp(join(tmpdir(), "hicreator-compatibility-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  return home;
}

for (const folder of ["plain", "space in path", "中文用户", "中文 空格", "apostrophe's", "parentheses (test)"]) {
  for (const client of ["codex", "claude", "cursor"]) {
    test(`${process.platform}: setup/update ${client} under ${folder}`, async (t) => {
      const root = await temporaryHome(t);
      const home = join(root, folder);
      const reports = [];
      const result = await setup({
        home, clients: [client], apiKey: fakeKey,
        verify: async () => ({ tools: ["test-tool"] }),
        report: (value) => reports.push(value),
      });
      assert.deepEqual(result.clients, [client]);
      assert.equal(result.verified, true);
      assert.ok(await pathExists(join(home, `.${client}`, "skills", "hicreator", "SKILL.md")));
      const config = await readFile(result.configPaths[client], "utf8");
      assert.ok(config.includes(fakeKey));
      assert.ok(!reports.join("\n").includes(fakeKey));
      for (const other of ["codex", "claude", "cursor"].filter((value) => value !== client)) {
        assert.equal(await pathExists(join(home, `.${other}`)), false);
      }
      const current = await prepare({ home });
      assert.equal(current.updated, false);
      await writeFile(join(current.targets[client], "SKILL.md"), "damaged");
      const repaired = await prepare({ home });
      assert.equal(repaired.updated, true);
      assert.ok((await readFile(join(repaired.targets[client], "SKILL.md"), "utf8")).includes("name: hicreator"));
    });
  }
}

for (const extension of process.platform === "win32" ? [".cmd", ".exe", ".bat"] : [""]) {
  test(`detects native client commands (${extension || "executable"}) without choosing WorkBuddy`, async (t) => {
    const root = await temporaryHome(t);
    const bin = join(root, "bin with 空格");
    await mkdir(bin);
    for (const client of ["codex", "claude", "cursor", "workbuddy"]) {
      await writeFile(join(bin, `${client}${extension}`), "test fixture", { mode: 0o700 });
    }
    assert.deepEqual(await detectClients(`${join(root, "missing")}${delimiter}${bin}`), ["codex", "claude", "cursor"]);
  });
}

for (const value of ["", " , ", "workbuddy", "codex,workbuddy"]) {
  test(`rejects unsupported or empty client selection: ${JSON.stringify(value)}`, () => {
    assert.throws(() => parseClients(value), /Select at least one|Unsupported clients/u);
  });
}

test("preserves unrelated settings when updating a configured client", async (t) => {
  const home = await temporaryHome(t);
  const existing = { theme: "dark", mcpServers: { unrelated: { command: "keep-me" } } };
  await mkdir(join(home, ".cursor"));
  await writeFile(join(home, ".cursor", "mcp.json"), JSON.stringify(existing));
  for (const key of [fakeKey, `${fakeKey}_rotated`]) {
    await configureClients({ home, clients: ["cursor"], apiKey: key, mcpUrl: "https://mcp.example.com/mcp" });
    const config = await readJson(join(home, ".cursor", "mcp.json"));
    assert.equal(config.theme, existing.theme);
    assert.deepEqual(config.mcpServers.unrelated, existing.mcpServers.unrelated);
    assert.deepEqual(Object.keys(config.mcpServers), ["unrelated", "hicreator"]);
    assert.equal(config.mcpServers.hicreator.headers.Authorization, `Bearer ${key}`);
  }
});

test("malformed config errors do not expose credential content or replace the file", async (t) => {
  const home = await temporaryHome(t);
  const file = join(home, ".claude.json");
  const content = `{"key":"${fakeKey}", broken}`;
  await writeFile(file, content);
  await assert.rejects(
    configureClients({ home, clients: ["claude"], apiKey: fakeKey, mcpUrl: "https://mcp.example.com/mcp" }),
    (error) => !error.message.includes(fakeKey) && /Cannot read JSON config/u.test(error.message),
  );
  assert.equal(await readFile(file, "utf8"), content);
});

test("noninteractive terminal fails before reading a secret", async () => {
  let output = "";
  await assert.rejects(readMaskedSecret({ input: { isTTY: false }, output: { write: (value) => { output += value; } } }), /interactive terminal/u);
  assert.equal(output, "");
});

for (const kind of ["auth", "protocol", "transient"]) {
  test(`bounds ${kind} retries without exposing the credential`, async () => {
    let attempts = 0;
    const reports = [];
    await assert.rejects(resolveSetupConnection({
      initialApiKey: fakeKey,
      verify: async () => { attempts += 1; throw new McpConnectionError("Connection rejected", { kind }); },
      sleep: async () => {}, report: (value) => reports.push(value),
    }), /Connection rejected/u);
    assert.equal(attempts, kind === "transient" ? 3 : 1);
    assert.ok(!reports.join("\n").includes(fakeKey));
  });
}

test("CLI rejects credential arguments without echoing them", async () => {
  await assert.rejects(runFile(process.execPath, ["bin/hicreator-agent.js", "setup", `--api-key=${fakeKey}`]), (error) => {
    assert.equal(error.code, 1);
    assert.ok(!error.stdout.includes(fakeKey));
    assert.ok(!error.stderr.includes(fakeKey));
    assert.match(error.stderr, /Do not pass API keys/u);
    return true;
  });
});

test("detects directory presence portably without opening it as a file", async (t) => {
  const root = await temporaryHome(t);
  assert.equal(await pathExists(root), true);
  assert.equal(await pathExists(join(root, "missing")), false);
});
