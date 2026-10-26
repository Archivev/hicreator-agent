# hiCreator Agent

Connect AI agents to hiCreator creator discovery, profile and video details, contact emails, reverse lookup by email, audience and fake-follower reports, and favorite-folder workflows. The installer provides verified one-step setup for Codex, Claude Code, and Cursor. Any client that supports remote Streamable HTTP MCP with a custom `Authorization` header can use the same tools.

## Requirements

- Node.js 20 or newer.
- A hiCreator Developer API key beginning with `hc_`.
- Codex, Claude Code, or Cursor for verified one-step setup, or another compatible MCP client for guided setup.

## Install

```bash
npx --yes --prefer-online hicreator-agent@latest setup
```

The installer detects supported clients, shows masked `*` feedback while the API key is entered, validates its format, and verifies the remote MCP connection using only protocol initialization and tool discovery. Invalid keys can be entered again, and temporary network or server failures retry the connection check up to three times. Client configuration is written only after verification succeeds.

To choose clients explicitly:

```bash
npx --yes --prefer-online hicreator-agent@latest setup --clients codex,claude,cursor
```

The API key is stored only in the selected clients' local configuration files. On macOS/Linux the installer applies owner-only file permissions; on Windows files inherit the user profile’s access controls. It never includes the key in command arguments or output.

## Updates

For installer-managed Skills, an optional update runs once at the start of each hiCreator workflow when Node.js/npm are available:

```bash
npx --yes --prefer-online hicreator-agent@latest prepare --json
```

`prepare` compares the bundled version and checksum, repairs missing or modified files, and atomically replaces older skill files. Manual installations and clients without command execution or npm use their installed Skill directly. A failed update does not block MCP usage. On native Windows, use `npx.cmd`; keep WSL installations separate from native Windows clients. MCP business logic runs remotely and updates immediately when hiCreator deploys it.

## Billing

Twitter AI search and similar-creator search cost 2 credits per returned creator; Instagram, YouTube, and TikTok cost 0.5. Reverse email lookup costs 1 credit per matched unique email, with unmatched emails refunded. Email lookup costs 0.2 credits for each valid creator profile URL, including when no public email is found. Creator and video details each cost 0.1 credits per successful query. New audience reports cost 40 credits and fake-follower reports cost 30 credits; eligible existing reports can be reused. These are default prices; server pricing takes precedence. The skill never automatically retries paid queries or report submissions.

Favorite-folder tools support creation, cursor pagination, folder details, rename, permanent deletion, member listing, single or batch removal, Workspace/public sharing with a stable link, and asynchronous Excel export for today, the last 7 days, or the last 30 days. Excel exports reuse hiCreator's existing 100,000-row and file-size safeguards.

## Platform coverage

Twitter/X supports AI and similar search with native post-view filters, audience reports, reverse email lookup, and favorites/sharing/export. Live profile/video details, contact-email lookup, and fake-follower checks remain limited to Instagram, YouTube, and TikTok. The product's batch Creator Lookup page is a separate workflow, not a public MCP tool.

Folder exports support optional ordered `columns` with custom labels and Chinese/English output. The shared skill documents metric differences and does not invent values for unsupported fields.

## Analysis reports

Submit one creator profile URL, save the returned task ID and type, and query that same task with `get_creator_report`. Poll about every 5 seconds while queued or running; stop on succeeded, unavailable, or failed. Report submission and polling are separate operations. YouTube comment-account indicators do not measure the share of fake subscribers.

## Release order

Deploy the backend's 21-tool MCP set before publishing this installer and the updated capabilities page. Setup checks every expected tool using `initialize` and `tools/list`, without executing business operations. Existing clients keep their previous tools; reload tool discovery to access additions. Skill updates alone do not deploy backend capabilities.

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
