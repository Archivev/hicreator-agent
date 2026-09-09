import { emitKeypressEvents } from "node:readline";

const API_KEY_PATTERN = /^hc_[A-Za-z0-9_-]+$/u;
const MIN_API_KEY_LENGTH = 20;
const MAX_API_KEY_LENGTH = 256;

export const DEFAULT_KEY_ATTEMPTS = 3;
export const DEFAULT_CONNECTION_ATTEMPTS = 3;

export function validateApiKey(value) {
  const apiKey = value?.trim();
  if (!apiKey) throw new Error("API Key is required.");
  if (!apiKey.startsWith("hc_")) {
    throw new Error("API Key must start with hc_.");
  }
  if (apiKey.length < MIN_API_KEY_LENGTH
      || apiKey.length > MAX_API_KEY_LENGTH) {
    throw new Error(
      `API Key must be ${MIN_API_KEY_LENGTH}-${MAX_API_KEY_LENGTH} characters long.`,
    );
  }
  if (!API_KEY_PATTERN.test(apiKey)) {
    throw new Error(
      "API Key may contain only letters, numbers, underscores, and hyphens.",
    );
  }
  return apiKey;
}

export async function readMaskedSecret({
  input = process.stdin,
  output = process.stderr,
  label = "hiCreator API Key: ",
  initializeKeypress = emitKeypressEvents,
} = {}) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error(
      "Set HICREATOR_API_KEY or run setup in an interactive terminal.",
    );
  }

  initializeKeypress(input);
  const wasRaw = Boolean(input.isRaw);
  let value = "";
  let settled = false;
  output.write(label);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      input.off("keypress", onKeypress);
      input.off("end", onEnd);
      input.off("error", onError);
      if (!wasRaw) input.setRawMode(false);
      input.pause?.();
    };
    const finish = (handler, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      output.write("\n");
      handler(result);
    };
    const onEnd = () => finish(
      reject,
      new Error("API Key input closed before completion."),
    );
    const onError = (error) => finish(reject, error);
    const onKeypress = (text, key = {}) => {
      if (key.ctrl && key.name === "c") {
        finish(reject, new Error("Setup cancelled."));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish(resolve, value);
        return;
      }
      if (key.name === "backspace" || key.name === "delete") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }
      if (key.ctrl || key.meta) return;
      const printable = [...(text ?? "")]
        .filter((character) => character >= " " && character !== "\x7f")
        .join("");
      if (!printable) return;
      value += printable;
      output.write("*".repeat([...printable].length));
    };

    input.on("keypress", onKeypress);
    input.once("end", onEnd);
    input.once("error", onError);
    if (!wasRaw) input.setRawMode(true);
    input.resume();
  });
}

export async function resolveSetupConnection({
  initialApiKey,
  prompt,
  verify,
  report = () => {},
  sleep = (milliseconds) => new Promise((resolve) =>
    setTimeout(resolve, milliseconds)),
  skipVerify = false,
  maxKeyAttempts = DEFAULT_KEY_ATTEMPTS,
  maxConnectionAttempts = DEFAULT_CONNECTION_ATTEMPTS,
}) {
  const interactive = initialApiKey === undefined && typeof prompt === "function";
  const keyAttempts = interactive ? maxKeyAttempts : 1;
  let candidate = initialApiKey;

  for (let keyAttempt = 1; keyAttempt <= keyAttempts; keyAttempt += 1) {
    if (candidate === undefined) {
      candidate = await prompt({ attempt: keyAttempt, maxAttempts: keyAttempts });
    }

    let apiKey;
    try {
      apiKey = validateApiKey(candidate);
      report("[ok] API Key received; format is valid.");
    } catch (error) {
      if (!interactive || keyAttempt === keyAttempts) throw error;
      report(`[retry] ${error.message}`);
      candidate = undefined;
      continue;
    }

    if (skipVerify) return { apiKey, connection: null };

    for (let connectionAttempt = 1;
      connectionAttempt <= maxConnectionAttempts;
      connectionAttempt += 1) {
      const suffix = connectionAttempt > 1
        ? ` (attempt ${connectionAttempt}/${maxConnectionAttempts})`
        : "";
      report(`[3/5] Verifying the MCP connection${suffix}...`);
      try {
        const connection = await verify(apiKey);
        report(`[ok] Connected; ${connection.tools.length} tools are available.`);
        return { apiKey, connection };
      } catch (error) {
        if (error?.kind === "auth" && interactive) {
          if (keyAttempt === keyAttempts) throw error;
          report(`[retry] ${error.message} Enter the API Key again.`);
          candidate = undefined;
          break;
        }
        const canRetry = error?.kind === "transient"
          && connectionAttempt < maxConnectionAttempts;
        if (!canRetry) throw error;
        report(`[retry] ${error.message} Retrying the free connection check.`);
        await sleep(500 * connectionAttempt);
      }
    }
  }

  throw new Error("Could not verify the API Key.");
}
