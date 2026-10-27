---
name: hicreator
description: Discover and evaluate Instagram, YouTube, TikTok, and Twitter/X creators with hiCreator; match emails to profiles, query supported details and reports, and organize, share, or export favorites.
---

# hiCreator

Use the connected hiCreator MCP tools for creator research and Workspace favorite folders. Choose the tools needed for the user's request; searching, analyzing, and saving are independent operations, not mandatory steps.

## Connection

Use the tools advertised by the current client. Installing this Skill does not connect MCP or guarantee that every tool below is deployed. If a required tool is missing, explain which capability is unavailable and use the client's MCP reload or setup instructions; do not substitute another paid operation.

For installations managed by `hicreator-agent` (the current client's target is in `~/.hicreator/manifest.json`), an optional update can run once before the first hiCreator tool call when Node.js 20+ and npm are available:

```bash
npx --yes --prefer-online hicreator-agent@latest prepare --json
```

Use `npx.cmd` in native Windows PowerShell/CMD and `npx` on macOS/WSL. Keep native Windows and WSL installations separate. If `updated: true`, reread the returned target's `SKILL.md`. Manual installations, unavailable commands, or a failed update should continue with the installed Skill without retrying the update or running `setup` just for updates.

API keys belong in the client's credential UI or the user's own local interactive terminal, never in chat, command arguments, or displayed configuration. The connection uses a Developer API Key bound to its user and Workspace; it requires a paid Workspace. Do not supply user or Workspace IDs in tool inputs.

## Choose a tool

| User intent | Tools |
|---|---|
| Find creators by a brief | `search_creators_ai` |
| Find creators like an account | `find_similar_creators` |
| Inspect a creator or video | `get_creator_detail`, `get_video_detail` |
| Find a public contact email | `find_creator_email` |
| Find existing creators associated with an email | `find_creators_by_email` |
| Analyze audience demographics | `create_audience_analysis`, then `get_creator_report` |
| Check fake-follower indicators | `create_fake_follower_check`, then `get_creator_report` |
| Find or inspect a folder | `list_creator_folders`, `get_creator_folder`, `list_creators_in_folder` |
| Organize favorites | `create_creator_folder`, `rename_creator_folder`, `add_creators_to_folder`, `remove_creator_from_folder`, `remove_creators_from_folder`, `delete_creator_folder` |
| Share a folder | `set_creator_folder_sharing` |
| Export a folder to Excel | `export_creator_folder`, then `get_creator_folder_export` |

## Platform support

| Capability | Instagram / YouTube / TikTok | Twitter / X |
|---|---|---|
| AI search, similar creators, audience analysis | Supported | Supported |
| Reverse lookup by email, favorites, sharing, export | Supported | Supported |
| Live creator/video details, find a contact email, fake-follower check | Supported | Not supported |

The product's **Creator Lookup / 查达人** page supports all four platforms at `/data/creator-lookup` (old `/data/email` links redirect). That batch lookup and its gated ingestion/refresh workflow are not public MCP tools. Do not emulate them by calling internal session endpoints or promise that a public detail/email query runs that workflow.

## Discovery and details

- Search supports `instagram`, `youtube`, `tiktok`, and `twitter`. Set platform, intent or reference account, and quantity from the request. Ask for missing choices that materially affect the result or cost. `limit` is 1–100 (default 40); do not silently increase it or issue additional searches.
- Pass `regions` and `excludedRegions` as ISO 3166-1 alpha-2 codes such as `US` or `GB`; a country cannot appear in both. Use structured filters for supported constraints. `workspaceDeduplicationEnabled` excludes previous Workspace search results; Workspace exclusions still apply when it is off. Verify hard constraints against returned data and say which remain unverified.
- For Twitter, use `filters.twitter` for account type, age range, average/median post views, following counts, and freshness. Do not send video play-count, creator-type, or face-visibility filters. Similar search accepts an X/Twitter profile URL or handle. Read [Twitter search](references/twitter-search.md) for a concrete request and metric distinctions.
- Details accept one complete profile URL (`profile_url`) or video URL (`video_url`), with platform inferred from the URL. Bare handles and IDs are not detail inputs. Preserve `canonicalUrl` and `retrievedAt`; missing fields mean unknown, not zero. Platform-specific fields are under `platformDetails`.
- Detail queries do not save or ingest a creator and do not return contact emails. Do not promise that a detail result can be added to favorites: adding requires an existing hiCreator creator with a stable `platform` and `creator_id`, such as a search result.
- Only call `find_creator_email` when requested and the selected result does not already contain the email. Never automatically enrich search, detail, report, or export results.

## Reverse lookup by email

`find_creators_by_email` accepts exactly one complete address: `{ "email": "contact@example.com" }` (up to 254 characters). Do not send `emails`, arrays, limits, or pagination parameters. The server trims and lowercases the email before exact matching in the four platforms' email inventories, then joins the matching user IDs to stored profiles. It does not crawl, refresh, or infer account ownership.

Read `data.email` and `data.creators`. All matching creators are returned, without a result cap or truncation; there is no `matches` wrapper, `hasMore`, or cursor. An empty `creators` array means no stored profile match, not that the email or creator does not exist. One email can match multiple creators across platforms; results are sorted by `platform` and `id`. A matched email costs once regardless of creator count; an unmatched email is refunded.

Each creator is a flat object using Creator Lookup / public search field names. Every field is present. Missing or platform-inapplicable values are `null`; known empty lists remain `[]`. Preserve nulls as unknown, never zero or false. Read [email reverse-lookup fields](references/email-reverse-lookup.md) for the response shape and complete field definitions. Use the top-level creator `id` with `platform` when explicitly asked to save a match to favorites. Preserve `requestId` and `billingRequestId` when reporting an uncertain paid result.

## Analysis reports

Both creation tools take one `profile_url`, subject to the platform matrix above. Twitter audience analysis accepts `x.com` and `twitter.com` profile URLs; it can be unavailable when the server has disabled that capability. Save the returned `data.id` and `data.type`; `requestId` identifies the request, not the report. Submission returns a task, not a completed analysis. Repeated submission creates another task; no client idempotency key is supported.

Call `get_creator_report` with `report_id: data.id` and the returned `type` (`audience_analysis` or `fake_follower_check`). Poll the same task about every 5 seconds while `queued` or `running`, without overlapping requests. When following multiple tasks, stagger checks and back off on rate limits. Stop on `succeeded`, `unavailable`, or `failed`. Read `data.errorCode` even when the tool call itself succeeds. If it remains pending beyond the current waiting window, return the task ID and type so it can be resumed; never submit a replacement merely to check progress.

Audience results contain country, age-range, and gender distributions. Fake-follower results differ by platform: Instagram/TikTok expose classification shares; YouTube exposes comment-account indicators and optional comment analysis. YouTube indicators can overlap and must not be added together. Suspicious commenters are not the share of fake subscribers. Preserve null or missing metrics as unknown; do not invent sample counts, confidence, or evidence absent from the response.

## Favorite folders

- Use a known folder ID directly with `get_creator_folder`; otherwise locate the requested folder with `list_creator_folders`. Create a folder only when needed. Names are unique within the Workspace.
- Folder and member lists use opaque cursors. Pass `nextCursor` unchanged, stop at null or when the requested selection is complete, and never reuse a member cursor with a different platform filter.
- Membership accepts all four platforms. Use stable `platform` + `creator_id` values from results, never a handle in place of an ID. Add/remove batches accept at most 100 items. Split explicit larger selections into stable batches and report per-item failures. Removing a favorite does not delete the creator profile; a missing membership returns `removed: false`.
- `delete_creator_folder` permanently deletes the folder and its memberships. Require an explicitly identified folder and confirmation of permanent deletion in the conversation; a general cleanup request is insufficient.
- Sharing uses `workspace` (same-Workspace sign-in required) or `public` (anyone with the link). Return the canonical URL from the response. Switching from `public` back to `workspace` keeps the same URL and restricts access; it does not disable the link.

## Excel export

`export_creator_folder` exports existing favorites across all platforms using a saved-date range: `today`, `7_days`, or `30_days`. Ask for the range if omitted; all-time export is unsupported. Use the user's IANA time zone when known, otherwise `UTC` and state that choice; select `zh-CN` or `en-US` for the requested output language. Exports retain hiCreator's 100,000-row and file-size safeguards.

Optional `columns` selects export fields in array order, e.g. `[{"key":"username"},{"key":"median_view_count","label":"Median views"}]`. Omit it to use the server's default columns. Use keys advertised by the tool schema; keys must be unique, and optional labels must be nonempty and contain no control characters. Twitter uses `median_view_count` / `average_view_count`; the video platforms use `median_play_count` / `average_play_count`. Missing platform-specific values remain blank. Chinese output uses `zh-CN`; other requested languages use `en-US`. Custom labels are used literally, without translation. Export reads stored data and does not refresh creators or purchase email lookups.

Save the returned job ID and call `get_creator_folder_export` for that same folder and job. A queued or running job is pending, not failed. On success, return the temporary download URL and filename; on failure, report the error. Do not create a second export while the first is pending. An optional `request_id` permits replay of the exact same export request; never reuse it for changed parameters.

## Cost and retries

Default prices: Twitter search and similar search cost 2 credits per returned creator; the other three platforms cost 0.5 (the requested limit is reserved first and unused quantity is refunded). Reverse email lookup costs 1 credit per matched email, regardless of how many creators match; unmatched emails are refunded. Other defaults: email lookup is 0.2 credits per valid profile URL even when no email is found; creator and video details are 0.1 credits per successful query. A new audience report is 40 credits and a new fake-follower report is 30 credits. Eligible reports already purchased by the Workspace may be reused without a new purchase; the server determines eligibility. Configured server pricing and returned billing information take precedence over these defaults.

Mention billing before a paid operation or when asked. State the operation and quantity; if the user has already specified them, proceed without asking again. Do not automatically add paid analysis or enrichment to a general discovery request.

Never automatically retry a paid query or report submission after a timeout, disconnect, or uncertain result. Explain the uncertainty and possible charge; keep any returned request, billing, or task IDs for investigation. For a known report task, resume status checks instead of submitting again.

Read-only folder/report/export queries and idempotent membership or sharing changes may be retried. After uncertain folder creation or deletion, inspect the folder state before deciding what to do; do not blindly replay. Never let a failed folder operation trigger another paid search.
