# hiCreator Agent

Connect AI agents to hiCreator creator search, email lookup, and favorites. The installer provides verified one-step setup for Codex, Claude Code, and Cursor. Any client that supports remote Streamable HTTP MCP with a custom `Authorization` header can use the same six tools.

## Requirements

- Node.js 20 or newer.
- A hiCreator Developer API key beginning with `hc_`.
- Codex, Claude Code, or Cursor for verified one-step setup, or another compatible MCP client for guided setup.

## Install

```bash
npx --yes --prefer-online hicreator-agent@latest setup
```

The installer detects supported clients, shows masked `*` feedback while the API key is entered, validates its format, and verifies the remote MCP connection without making a paid call. Invalid keys can be entered again, and temporary network or server failures retry the free connection check up to three times. Client configuration is written only after verification succeeds.

To choose clients explicitly:

```bash
npx --yes --prefer-online hicreator-agent@latest setup --clients codex,claude,cursor
```

The API key is stored only in the selected clients' local configuration files. The installer applies owner-only file permissions and never includes the key in command arguments or output.

## Updates

The skill runs this once at the start of each hiCreator workflow:

```bash
npx --yes --prefer-online hicreator-agent@latest prepare --json
```

`prepare` compares the bundled version and checksum, repairs missing or modified files, and atomically replaces older skill files. MCP business logic runs remotely and updates immediately when hiCreator deploys it.

## Billing

AI search is a free feature. Similar-creator search costs 0.5 credits per call, and email lookup costs 0.1 credits for each valid creator profile URL. The skill never automatically retries paid tools.

## Local Files

- hiCreator state: `~/.hicreator/manifest.json`
- Codex skill: `~/.codex/skills/hicreator/`
- Claude Code skill: `~/.claude/skills/hicreator/`
- Cursor skill: `~/.cursor/skills/hicreator/`

Existing unrelated MCP servers and settings are preserved.

## Other AI Clients

For clients outside the verified list, add the remote MCP server using the client's official configuration:

- Transport: Streamable HTTP
- URL: `https://mcp.hicreator.ai/mcp`
- Header: `Authorization: Bearer <HICREATOR_API_KEY>`

Keep the API key in the client's local secret or header configuration. Do not paste it into an AI conversation. If the client also implements the Agent Skills specification, install `skills/hicreator/` into its supported skills directory; the MCP tools still work when Agent Skills are unavailable.
