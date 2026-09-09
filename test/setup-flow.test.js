import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { McpConnectionError } from "../src/mcp-check.js";
import {
  readMaskedSecret,
  resolveSetupConnection,
  validateApiKey,
} from "../src/setup-flow.js";

class FakeTty extends EventEmitter {
  isTTY = true;
  isRaw = false;
  paused = true;

  setRawMode(value) {
    this.isRaw = value;
  }

  isPaused() {
    return this.paused;
  }

  resume() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }
}

test("shows masked keypress feedback and restores the terminal", async () => {
  const input = new FakeTty();
  let rendered = "";
  const answer = readMaskedSecret({
    input,
    output: { write: (value) => { rendered += value; } },
    initializeKeypress: () => {},
  });

  input.emit("keypress", "hc_wrong", {});
  input.emit("keypress", "", { name: "backspace" });
  input.emit("keypress", "g", { name: "g" });
  input.emit("keypress", "", { name: "return" });

  assert.equal(await answer, "hc_wrong");
  assert.match(rendered, /^hiCreator API Key: \*{8}\x08 \x08\*\n$/u);
  assert.doesNotMatch(rendered, /hc_wrong/u);
  assert.equal(input.isRaw, false);
  assert.equal(input.paused, true);
});

test("validates key format with actionable errors", () => {
  assert.throws(() => validateApiKey(""), /required/u);
  assert.throws(() => validateApiKey("not-a-key"), /start with hc_/u);
  assert.throws(() => validateApiKey("hc_short"), /20-256/u);
  assert.throws(
    () => validateApiKey("hc_key.with.invalid.characters"),
    /letters, numbers, underscores, and hyphens/u,
  );
  assert.equal(
    validateApiKey("  hc_valid_key_long_enough  "),
    "hc_valid_key_long_enough",
  );
});

test("allows format and authorization failures to be corrected", async () => {
  const answers = [
    "wrong",
    "hc_rejected_key_long_enough",
    "hc_accepted_key_long_enough",
  ];
  const reports = [];
  const verified = [];
  const result = await resolveSetupConnection({
    prompt: async () => answers.shift(),
    verify: async (apiKey) => {
      verified.push(apiKey);
      if (apiKey.includes("rejected")) {
        throw new McpConnectionError("The API Key was rejected (HTTP 401).", {
          kind: "auth",
          status: 401,
        });
      }
      return { tools: Array.from({ length: 6 }) };
    },
    report: (message) => reports.push(message),
  });

  assert.equal(result.apiKey, "hc_accepted_key_long_enough");
  assert.equal(result.connection.tools.length, 6);
  assert.deepEqual(verified, [
    "hc_rejected_key_long_enough",
    "hc_accepted_key_long_enough",
  ]);
  assert.equal(reports.filter((message) => message.startsWith("[retry]")).length, 2);
});

test("retries only transient connection failures", async () => {
  let attempts = 0;
  const waits = [];
  const result = await resolveSetupConnection({
    initialApiKey: "hc_valid_key_long_enough",
    verify: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new McpConnectionError("Temporary failure.", {
          kind: "transient",
        });
      }
      return { tools: Array.from({ length: 6 }) };
    },
    sleep: async (milliseconds) => { waits.push(milliseconds); },
  });

  assert.equal(result.connection.tools.length, 6);
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [500, 1_000]);
});

test("does not retry protocol failures", async () => {
  let attempts = 0;
  await assert.rejects(() => resolveSetupConnection({
    initialApiKey: "hc_valid_key_long_enough",
    verify: async () => {
      attempts += 1;
      throw new McpConnectionError("Unexpected response.", {
        kind: "protocol",
      });
    },
  }), /Unexpected response/u);
  assert.equal(attempts, 1);
});
