import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const SKILL_NAME = "hicreator";
export const SERVER_NAME = "hicreator";
export const DEFAULT_MCP_URL = "https://mcp.hicreator.ai/mcp";
export const SUPPORTED_CLIENTS = ["codex", "claude", "cursor"];
