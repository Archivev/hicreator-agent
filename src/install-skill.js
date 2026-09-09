import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

import { PACKAGE_ROOT, SKILL_NAME } from "./constants.js";
import { pathExists, readJson, writeJsonAtomic } from "./files.js";

const LOCK_WAIT_MS = 15_000;
const STALE_LOCK_MS = 120_000;

export function clientSkillPath(home, client) {
  return join(home, `.${client}`, "skills", SKILL_NAME);
}

async function directoryChecksum(root) {
  const hash = createHash("sha256");

  async function visit(path, relative = "") {
    const entries = await readdir(path, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = join(path, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      hash.update(childRelative);
      hash.update("\0");
      if (entry.isDirectory()) await visit(child, childRelative);
      else hash.update(await readFile(child));
      hash.update("\0");
    }
  }

  await visit(root);
  return hash.digest("hex");
}

async function packageVersion() {
  const packageJson = JSON.parse(
    await readFile(join(PACKAGE_ROOT, "package.json"), "utf8"),
  );
  return packageJson.version;
}

async function acquireLock(root) {
  const lockPath = join(root, "update.lock");
  const startedAt = Date.now();
  while (true) {
    try {
      await mkdir(lockPath);
      return async () => rm(lockPath, { recursive: true, force: true });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const lock = await stat(lockPath).catch(() => null);
      if (lock && Date.now() - lock.mtimeMs > STALE_LOCK_MS) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - startedAt >= LOCK_WAIT_MS) {
        throw new Error("Another hiCreator update is still running.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function replaceDirectory(source, target, backup) {
  await mkdir(dirname(target), { recursive: true });
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const rollback = `${temporary}.rollback`;
  await cp(source, temporary, { recursive: true });
  const hadPrevious = await pathExists(target);
  if (hadPrevious) {
    await mkdir(dirname(backup), { recursive: true });
    await cp(target, backup, { recursive: true });
    await rename(target, rollback);
  }
  try {
    await rename(temporary, target);
    if (hadPrevious) await rm(rollback, { recursive: true, force: true });
  } catch (error) {
    if (hadPrevious && await pathExists(rollback)) {
      await rename(rollback, target);
    }
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function syncSkill({ home, clients, source = "npm" }) {
  const stateRoot = join(home, ".hicreator");
  await mkdir(stateRoot, { recursive: true });
  const release = await acquireLock(stateRoot);
  try {
    const bundledSkill = join(PACKAGE_ROOT, "skills", SKILL_NAME);
    const version = await packageVersion();
    const checksum = await directoryChecksum(bundledSkill);
    const manifestPath = join(stateRoot, "manifest.json");
    const previous = await readJson(manifestPath, null);
    const targets = Object.fromEntries(
      clients.map((client) => [client, clientSkillPath(home, client)]),
    );
    let updated = previous?.version !== version
      || previous?.checksum !== checksum;

    for (const [client, target] of Object.entries(targets)) {
      const currentChecksum = await pathExists(target)
        ? await directoryChecksum(target)
        : null;
      if (currentChecksum === checksum) continue;
      updated = true;
      const backupVersion = previous?.version ?? "unknown";
      const backup = join(
        stateRoot,
        "backups",
        `${backupVersion}-${Date.now()}`,
        client,
      );
      await replaceDirectory(bundledSkill, target, backup);
    }

    const installedAt = previous?.installedAt ?? new Date().toISOString();
    await writeJsonAtomic(manifestPath, {
      version,
      checksum,
      installedAt,
      updatedAt: new Date().toISOString(),
      source,
      targets,
    });
    return {
      version,
      updated,
      offline: process.env.npm_config_offline === "true",
      skillPath: targets.codex ?? Object.values(targets)[0],
      targets,
    };
  } finally {
    await release();
  }
}

export async function installedClients(home) {
  const manifest = await readJson(join(home, ".hicreator", "manifest.json"), null);
  return manifest?.targets ? Object.keys(manifest.targets) : [];
}
