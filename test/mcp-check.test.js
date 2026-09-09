import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { verifyMcp } from "../src/mcp-check.js";

const tools = [
  "search_creators_ai",
  "find_similar_creators",
  "find_creator_email",
  "create_creator_folder",
  "list_creator_folders",
  "add_creators_to_folder",
];

test("verifies initialize and all six tools without calling a business tool", async () => {
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
