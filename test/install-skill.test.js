import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { clientSkillPath, syncSkill } from "../src/install-skill.js";

const packageVersion = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
).version;

test("installs, skips unchanged content, and repairs a modified skill", async () => {
  const home = await mkdtemp(join(tmpdir(), "hicreator-agent-skill-"));
  const clients = ["codex", "claude", "cursor"];
  const installed = await syncSkill({ home, clients });
  assert.equal(installed.updated, true);
  assert.equal(installed.version, packageVersion);

  for (const client of clients) {
    const skill = await readFile(
      join(clientSkillPath(home, client), "SKILL.md"),
      "utf8",
    );
    assert.match(skill, /name: hicreator/u);
    assert.match(skill, /ISO 3166-1 alpha-2/u);
    assert.match(skill, /each cost 0\.5 credits per returned creator/u);
    assert.match(skill, /0\.1 credits for each valid creator profile URL/u);
    assert.match(skill, /\/hicreator Find 10 Instagram tennis creators/u);
  }

  const unchanged = await syncSkill({ home, clients });
  assert.equal(unchanged.updated, false);

  const codexSkill = join(clientSkillPath(home, "codex"), "SKILL.md");
  await writeFile(codexSkill, "damaged\n");
  const repaired = await syncSkill({ home, clients });
  assert.equal(repaired.updated, true);
  assert.match(await readFile(codexSkill, "utf8"), /name: hicreator/u);

  const manifest = JSON.parse(
    await readFile(join(home, ".hicreator", "manifest.json"), "utf8"),
  );
  assert.equal(manifest.version, packageVersion);
  assert.equal(manifest.checksum.length, 64);
});

test("serializes concurrent prepare operations with a local lock", async () => {
  const home = await mkdtemp(join(tmpdir(), "hicreator-agent-lock-"));
  const results = await Promise.all([
    syncSkill({ home, clients: ["codex"] }),
    syncSkill({ home, clients: ["codex"] }),
  ]);
  assert.equal(results.filter((result) => result.updated).length, 1);
  assert.match(
    await readFile(join(clientSkillPath(home, "codex"), "SKILL.md"), "utf8"),
    /name: hicreator/u,
  );
});
