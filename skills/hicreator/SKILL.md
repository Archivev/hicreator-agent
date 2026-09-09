---
name: hicreator
description: Find Instagram, YouTube, or TikTok creators, find similar creators or public contact emails, and organize creators in hiCreator favorites. Use when the user asks for creator discovery, creator email lookup, or saving creator results to hiCreator.
---

# hiCreator

Use the hiCreator MCP tools to find and organize creators through natural language.

## Start

At the beginning of each hiCreator workflow, run:

```bash
npx --yes --prefer-online hicreator-agent@latest prepare --json
```

Run it once per user workflow, before the first hiCreator tool call. If it returns `updated: true`, read the `SKILL.md` at the returned `skillPath` again before continuing. If npm cannot be reached, continue with this installed Skill and do not retry the update during the same workflow. Never print, request through chat, or pass the API key on a command line.

## Workflow

1. Infer or confirm the platform, requested count, hard filters, and whether the user wants results saved.
2. Convert requested countries or regions to ISO 3166-1 alpha-2 codes before passing `regions` (for example, `US` or `GB`). Never pass country names.
3. Use `search_creators_ai` for intent-based discovery or `find_similar_creators` for a reference account.
4. Check returned results against hard constraints and state which constraints the data could not verify.
5. To save results, call `list_creator_folders`; create the destination favorites list with `create_creator_folder` only when needed; then call `add_creators_to_folder` once with stable `platform` and `creator_id` values from search results.
6. Call `find_creator_email` only when the user explicitly asks for an email and the selected result does not already include one.
7. Report returned count, verified constraints, favorites result, and any per-item failures.

## Billing Safety

`search_creators_ai`, `find_similar_creators`, and `find_creator_email` consume credits. Search cost scales with `limit`; email lookup charges one lookup. State the operation and quantity before a paid call. When the user's request already specifies them, proceed without asking the same question again.

Never automatically retry a paid tool after a timeout, disconnect, or uncertain result. Tell the user the request may have been charged and ask them to inspect API history before deciding whether to retry. Never silently raise `limit`, broaden filters, run a second search, or perform email lookup.

Favorites listing, creation, and batch add are free. A failed free favorites operation may be retried without repeating the paid search. Do not claim support for deletion, rename, removal, or sharing.
