const PROTOCOL_VERSION = "2025-06-18";
const EXPECTED_TOOLS = [
  "search_creators_ai",
  "find_similar_creators",
  "find_creator_email",
  "create_creator_folder",
  "list_creator_folders",
  "add_creators_to_folder",
];

export class McpConnectionError extends Error {
  constructor(message, { kind, status, cause } = {}) {
    super(message, { cause });
    this.name = "McpConnectionError";
    this.kind = kind;
    this.status = status;
  }
}

function parseMcpPayload(text) {
  if (text.trimStart().startsWith("{")) return JSON.parse(text);
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  if (!data) throw new Error("MCP response did not contain a JSON result.");
  return JSON.parse(data.slice("data: ".length));
}

async function request(mcpUrl, apiKey, id, method, params) {
  let response;
  try {
    response = await fetch(mcpUrl, {
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
  } catch (error) {
    const timedOut = error?.name === "TimeoutError"
      || error?.name === "AbortError";
    throw new McpConnectionError(
      timedOut
        ? "The hiCreator MCP connection timed out."
        : "Could not reach the hiCreator MCP server.",
      { kind: "transient", cause: error },
    );
  }
  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new McpConnectionError(
        `The API Key was rejected (HTTP ${status}). It may be invalid, disabled, or deleted.`,
        { kind: "auth", status },
      );
    }
    const transient = status === 408 || status === 429 || status >= 500;
    throw new McpConnectionError(
      transient
        ? `The hiCreator MCP server is temporarily unavailable (HTTP ${status}).`
        : `The hiCreator MCP server rejected the connection check (HTTP ${status}).`,
      { kind: transient ? "transient" : "protocol", status },
    );
  }
  try {
    return parseMcpPayload(await response.text());
  } catch (error) {
    throw new McpConnectionError(
      "The hiCreator MCP server returned an unreadable response.",
      { kind: "protocol", cause: error },
    );
  }
}

export async function verifyMcp(mcpUrl, apiKey, { clientVersion = "unknown" } = {}) {
  const initialized = await request(mcpUrl, apiKey, 1, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "hicreator-agent-setup", version: clientVersion },
  });
  if (initialized.error || initialized.result?.serverInfo?.name !== "hicreator") {
    throw new McpConnectionError(
      "The hiCreator MCP server returned an unexpected initialize response.",
      { kind: "protocol" },
    );
  }
  const listed = await request(mcpUrl, apiKey, 2, "tools/list");
  const tools = listed.result?.tools?.map((tool) => tool.name);
  if (!Array.isArray(tools)
      || EXPECTED_TOOLS.some((tool) => !tools.includes(tool))) {
    throw new McpConnectionError(
      "The hiCreator MCP server did not advertise all six tools.",
      { kind: "protocol" },
    );
  }
  return { server: initialized.result.serverInfo, tools };
}
