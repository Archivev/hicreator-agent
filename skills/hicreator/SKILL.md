---
name: hicreator
description: Find Instagram, YouTube, or TikTok creators, look up public contact emails, and manage, share, or export hiCreator favorite folders. Use for creator discovery and hiCreator favorites workflows.
---

# hiCreator

Use the hiCreator MCP tools to find creators and manage Workspace favorite folders through natural language.

Users can invoke the Skill explicitly or describe the request directly:

```text
/hicreator Find 10 Instagram tennis creators
Find 20 US pet product reviewers on TikTok with at least 100K followers
```

## Start

At the beginning of each hiCreator workflow, run:

```bash
npx --yes --prefer-online hicreator-agent@latest prepare --json
```

Run it once per user workflow, before the first hiCreator tool call. If it returns `updated: true`, read the `SKILL.md` at the returned `skillPath` again before continuing. If npm cannot be reached, continue with this installed Skill and do not retry the update during the same workflow. Never print, request through chat, or pass the API key on a command line.

## Workflow

1. Identify whether the request is creator discovery, email lookup, or favorite-folder management. Infer or confirm only information required for that operation.
2. Convert requested countries or regions to ISO 3166-1 alpha-2 codes before passing `regions` (for example, `US` or `GB`). Never pass country names.
3. Use `search_creators_ai` for intent-based discovery or `find_similar_creators` for a reference account.
4. Check returned results against hard constraints and state which constraints the data could not verify.
5. To save results, call `list_creator_folders`; create the destination folder with `create_creator_folder` only when needed; then call `add_creators_to_folder` with stable `platform` and `creator_id` values from search results.
6. Call `find_creator_email` only when the user explicitly asks for an email and the selected result does not already include one.
7. Report returned count, verified constraints, favorites result, and any per-item failures.

## Favorite Folders

- `list_creator_folders` and `list_creators_in_folder` use opaque cursor pagination. Reuse `nextCursor` unchanged and stop when it is `null`. Do not fabricate, edit, or reuse a cursor with a different platform filter.
- `rename_creator_folder` changes only the folder name. Names are unique within the Workspace.
- `add_creators_to_folder` and `remove_creators_from_folder` accept at most 100 items per call. Split larger explicit selections into stable batches and report every returned status. Removing a favorite never deletes the creator profile.
- Use `remove_creator_from_folder` for one creator. A missing membership returns `removed: false` and is not an error.
- `delete_creator_folder` permanently deletes the folder and all of its favorite memberships. Call it only after the user has explicitly identified the folder and confirmed permanent deletion in the current conversation. Never infer confirmation from a general cleanup request.

## Sharing

Use `set_creator_folder_sharing` with one of these scopes:

- `workspace`: the stable link requires the viewer to sign in as a member of the same Workspace.
- `public`: anyone with the stable link can view the latest folder contents.

The response contains the canonical share URL. Switching from `public` back to `workspace` cancels public access but intentionally keeps the same slug and URL. Do not describe `workspace` as an unshared or link-disabled state.

## Excel Export

`export_creator_folder` starts the product's existing asynchronous `creator.list.v1` export. It exports all platforms in the selected folder, using exactly one supported saved-date range: `today`, `7_days`, or `30_days`. If the user does not state the range, ask before starting. Do not claim all-time export support.

Use the user's IANA time zone when known; otherwise use `UTC` and state that choice. Export only data already stored by hiCreator; never call `find_creator_email` or another paid tool to enrich an export unless the user separately asks. Preserve the product's existing 100,000-row and file-size safeguards. After starting, call `get_creator_folder_export` with the returned job ID. A queued or running job is not a failure; check again without starting a second export. When the job succeeds, return the temporary download URL and file name. When it fails, report the returned error and do not silently create another job.

## Billing Safety

`search_creators_ai` and `find_similar_creators` each cost 0.5 credits per returned creator. `find_creator_email` costs 0.1 credits for each valid creator profile URL. State the operation and quantity before a paid call. When the user's request already specifies them, proceed without asking the same question again.

Mention billing only before a paid call or when the user asks about it. Do not describe favorite-folder operations as free or volunteer that they do not consume credits.

Never automatically retry a paid tool after a timeout, disconnect, or uncertain result. Tell the user the request may have been charged and ask them to inspect API history before deciding whether to retry. Never silently raise `limit`, broaden filters, run a second search, or perform email lookup.

Favorite-folder reads, idempotent add/remove calls, sharing changes, and export status checks may be retried without repeating a paid search. Never retry permanent folder deletion after an uncertain result without listing folders to verify whether it already succeeded. Never create a second export merely because the first is still queued or running.
