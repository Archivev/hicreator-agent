# TikTok video cart search and checks

## AI search and similar creators

Both `search_creators_ai` and `find_similar_creators` accept `filters.videoCartOnly: true` with `platform: "tiktok"`. The option defaults to false. It selects creators with stored positive cart evidence; it does not prove current TikTok Shop eligibility or product availability.

For AI search:

```json
{
  "platform": "tiktok",
  "query": "US beauty creators",
  "limit": 10,
  "filters": { "regions": ["US"], "videoCartOnly": true }
}
```

For similar search, use the same filter and replace `query` with `target_account`, for example `"https://www.tiktok.com/@example_creator"`.

The configured base price gains a 1-credit surcharge per returned creator (default 0.5 → 1.5). The requested quantity is reserved and unused quantity refunded. Other platforms reject true before billing. If the feature is disabled or the client schema lacks it, report that limitation; do not silently run an ordinary search or extra paid detail checks. Do not retry an uncertain paid search.

`hasVideoCart` is the response field at `data.items[].hasVideoCart`; the input filter is `filters.videoCartOnly`. If the user only asks to filter an already-returned shortlist, use its existing flags without another paid call and report unknowns separately. Never issue extra searches to silently fill a cart-only quota.

## Live creator check

When the user requests a live cart check for one TikTok creator, call `get_creator_detail` with `include_video_cart: true`. This option is separate from search filtering and is not accepted by the recent-posts tool.

```json
{
  "profile_url": "https://www.tiktok.com/@example_creator",
  "include_video_cart": true
}
```

Read `data.creator.platformDetails.hasVideoCart`:

| Value | Meaning |
|---|---|
| `true` | A cart tag was found in this request's sample. |
| `false` | Valid samples contained no cart tag. |
| `null` | Evidence was insufficient, including an empty list or missing metadata. |

The request checks one page of up to 30 recent posts. It may contain pinned posts or fewer than 30 items; do not promise a complete chronological window or full account history. The flag does not establish current TikTok Shop eligibility or product availability. Preserve unknown values rather than converting them to false.

Search `data.items[].hasVideoCart` describes stored observations. A known positive is retained after later samples contain no cart tags, so a stored true and a live false can both be valid. Explain their different evidence windows; do not overwrite or reinterpret one using the other.

Without the option, creator details omit the flag and use the base price. Enabling it is TikTok-only and doubles the configured detail price (default 0.1 → 0.2 credits). A successful `null` result is still charged. Unsupported platforms are rejected before billing; provider failures and timeouts fail the whole request and follow the full-refund path. Preserve request and billing IDs when the outcome is uncertain, and never automatically retry a paid check.
