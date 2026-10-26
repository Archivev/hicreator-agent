import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { McpConnectionError, verifyMcp } from "../src/mcp-check.js";

const tools = [
  "search_creators_ai",
  "find_similar_creators",
  "find_creator_email",
  "find_creators_by_email",
  "get_creator_detail",
  "get_video_detail",
  "create_audience_analysis",
  "create_fake_follower_check",
  "get_creator_report",
  "create_creator_folder",
  "list_creator_folders",
  "get_creator_folder",
  "rename_creator_folder",
  "delete_creator_folder",
  "list_creators_in_folder",
  "add_creators_to_folder",
  "remove_creator_from_folder",
  "remove_creators_from_folder",
  "set_creator_folder_sharing",
  "export_creator_folder",
  "get_creator_folder_export",
];

const runFile = promisify(execFile);

test("verifies initialize and the complete toolset without calling a business tool", async () => {
  const methods = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      assert.equal(request.headers.authorization, "Bearer hc_test_key_long_enough");
      const message = JSON.parse(body);
      methods.push(message.method);
      const result = message.method === "initialize"
        ? {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "hicreator", version: "1.0.0" },
          }
        : { tools: tools.map((name) => ({ name, inputSchema: { type: "object" } })) };
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(`event: message\ndata: ${JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result,
      })}\n\n`);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const result = await verifyMcp(
      `http://127.0.0.1:${address.port}/mcp`,
      "hc_test_key_long_enough",
    );
    assert.deepEqual(result.tools, tools);
    assert.deepEqual(methods, ["initialize", "tools/list"]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) =>
      error ? reject(error) : resolve()));
  }
});

test("classifies authentication failures without exposing the key", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(401).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    await assert.rejects(
      () => verifyMcp(
        `http://127.0.0.1:${address.port}/mcp`,
        "hc_rejected_key_long_enough",
      ),
      (error) => {
        assert.ok(error instanceof McpConnectionError);
        assert.equal(error.kind, "auth");
        assert.equal(error.status, 401);
        assert.doesNotMatch(error.message, /hc_rejected/u);
        return true;
      },
    );
  } finally {
    await new Promise((resolve, reject) => server.close((error) =>
      error ? reject(error) : resolve()));
  }
});

async function withMcpServer(t, reply) {
  const methods = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const message = JSON.parse(body);
      methods.push(message.method);
      reply(message, response);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}/mcp`, methods };
}

for (const [status, kind] of [[400, "protocol"], [401, "auth"], [403, "auth"], [404, "protocol"], [408, "transient"], [429, "transient"], [500, "transient"], [502, "transient"], [503, "transient"]]) {
  test(`classifies HTTP ${status} without echoing a server response`, async (t) => {
    const { url, methods } = await withMcpServer(t, (_message, response) => {
      response.writeHead(status).end("hc_sensitive_response_not_for_logs");
    });
    await assert.rejects(verifyMcp(url, "hc_test_key_long_enough"), (error) => {
      assert.equal(error.kind, kind);
      assert.equal(error.status, status);
      assert.doesNotMatch(error.message, /hc_sensitive|hc_test/u);
      return true;
    });
    assert.deepEqual(methods, ["initialize"]);
  });
}

for (const format of ["json", "sse-lf", "sse-crlf"]) {
  for (const variant of ["complete", "extra-tool", "wrong-names-same-count", "missing-tool", "missing-report-query", "legacy-20-tools"]) {
    test(`${format} discovers ${variant} by tool names rather than count`, async (t) => {
      const names = variant === "complete" ? tools
        : variant === "extra-tool" ? [...tools, "future_tool"]
          : variant === "wrong-names-same-count" ? [...tools.slice(1), "wrong_tool"]
            : variant === "legacy-20-tools" ? tools.filter((name) => name !== "find_creators_by_email")
            : variant === "missing-report-query" ? tools.filter((name) => name !== "get_creator_report")
            : tools.slice(1);
      const { url, methods } = await withMcpServer(t, (message, response) => {
        const result = message.method === "initialize"
          ? { serverInfo: { name: "hicreator", version: "test" } }
          : { tools: names.map((name) => ({ name })) };
        const json = JSON.stringify({ jsonrpc: "2.0", id: message.id, result });
        response.writeHead(200, { "Content-Type": format === "json" ? "application/json" : "text/event-stream" });
        response.end(format === "json" ? json : `event: message\ndata: ${json}\n\n`.replaceAll("\n", format === "sse-crlf" ? "\r\n" : "\n"));
      });
      if (variant === "complete" || variant === "extra-tool") {
        assert.deepEqual((await verifyMcp(url, "hc_test_key_long_enough")).tools, names);
      } else {
        await assert.rejects(verifyMcp(url, "hc_test_key_long_enough"), (error) => error.kind === "protocol");
      }
      assert.deepEqual(methods, ["initialize", "tools/list"]);
    });
  }
}

for (const client of ["codex", "claude", "cursor"]) {
  test(`native CLI installs ${client} and prepares through a real subprocess`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "hicreator-cli-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const home = join(root, "用户 with spaces");
    await mkdir(home);
    const { url, methods } = await withMcpServer(t, (message, response) => {
      const result = message.method === "initialize"
        ? { serverInfo: { name: "hicreator", version: "test" } }
        : { tools: tools.map((name) => ({ name })) };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
    });
    const env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      HICREATOR_API_KEY: "hc_subprocess_test_not_a_real_credential",
    };
    const installed = await runFile(process.execPath, ["bin/hicreator-agent.js", "setup", "--clients", client, "--mcp-url", url, "--json"], { env });
    const result = JSON.parse(installed.stdout);
    assert.deepEqual(result.clients, [client]);
    assert.equal(result.verified, true);
    assert.equal(result.toolCount, tools.length);
    assert.ok(result.targets[client].startsWith(home));
    assert.ok((await readFile(result.configPaths[client], "utf8")).includes(url));
    assert.ok(!installed.stdout.includes(env.HICREATOR_API_KEY));
    assert.ok(!installed.stderr.includes(env.HICREATOR_API_KEY));
    const prepared = await runFile(process.execPath, ["bin/hicreator-agent.js", "prepare", "--json"], { env });
    assert.equal(JSON.parse(prepared.stdout).updated, false);
    assert.deepEqual(methods, ["initialize", "tools/list"]);
  });
}
