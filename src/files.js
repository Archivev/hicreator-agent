import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    // JSON parse errors can include parts of the file, including credentials.
    throw new Error(`Cannot read JSON config at ${path}. Check its format and permissions.`);
  }
}

export async function writeFileAtomic(path, content, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await writeFile(temporary, content, { mode });
  await rename(temporary, path);
  await chmod(path, mode);
}

export async function writeJsonAtomic(path, value, mode = 0o600) {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`, mode);
}
