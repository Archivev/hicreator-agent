# hiCreator Agent

Install one hiCreator skill and remote MCP connection for Codex, Claude Code, and Cursor. It provides AI creator search, similar-creator search, email lookup, folder creation, folder listing, and batch save.

## Requirements

- Node.js 20 or newer.
- A hiCreator Developer API key beginning with `hc_`.
- Codex, Claude Code, or Cursor installed locally.

## Install

```bash
npx --yes --prefer-online @hicreator/agent@latest setup
```

The installer detects supported clients, asks for the API key without echoing it, verifies the remote MCP connection without making a paid call, installs the skill, and merges a `hicreator` MCP entry into each user configuration.

To choose clients explicitly:

```bash
npx --yes --prefer-online @hicreator/agent@latest setup --clients codex,claude,cursor
```

The API key is stored only in the selected clients' local configuration files. The installer applies owner-only file permissions and never includes the key in command arguments or output.

## Updates

The skill runs this once at the start of each hiCreator workflow:

```bash
npx --yes --prefer-online @hicreator/agent@latest prepare --json
```

`prepare` compares the bundled version and checksum, repairs missing or modified files, and atomically replaces older skill files. MCP business logic runs remotely and updates immediately when hiCreator deploys it.

## Billing

AI search, similar-creator search, and email lookup consume hiCreator credits. The skill never automatically retries those tools. Creating, listing, and adding existing creators to folders are free.

## Local Files

- hiCreator state: `~/.hicreator/manifest.json`
- Codex skill: `~/.codex/skills/hicreator/`
- Claude Code skill: `~/.claude/skills/hicreator/`
- Cursor skill: `~/.cursor/skills/hicreator/`

Existing unrelated MCP servers and settings are preserved.
