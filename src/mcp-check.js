const PROTOCOL_VERSION = "2025-06-18";
const EXPECTED_TOOLS = [
  "search_creators_ai",
  "find_similar_creators",
  "find_creator_email",
  "create_creator_folder",
  "list_creator_folders",
  "add_creators_to_folder",
];

function parseMcpPayload(text) {
  if (text.trimStart().startsWith("{")) return JSON.parse(text);
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  if (!data) throw new Error("MCP response did not contain a JSON result.");
  return JSON.parse(data.slice("data: ".length));
}

async function request(mcpUrl, apiKey, id, method, params) {
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`MCP connection failed with HTTP ${response.status}.`);
  }
  return parseMcpPayload(await response.text());
}

export async function verifyMcp(mcpUrl, apiKey) {
  const initialized = await request(mcpUrl, apiKey, 1, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "hicreator-agent-setup", version: "0.1.0" },
  });
  if (initialized.error || initialized.result?.serverInfo?.name !== "hicreator") {
    throw new Error("MCP initialize returned an unexpected response.");
  }
  const listed = await request(mcpUrl, apiKey, 2, "tools/list");
  const tools = listed.result?.tools?.map((tool) => tool.name);
  if (!Array.isArray(tools)
      || EXPECTED_TOOLS.some((tool) => !tools.includes(tool))) {
    throw new Error("MCP server did not advertise all six hiCreator tools.");
  }
  return { server: initialized.result.serverInfo, tools };
}
