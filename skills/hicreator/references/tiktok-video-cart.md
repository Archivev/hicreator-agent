# TikTok video cart checks

Use the existing search result when the user asks to filter a returned shortlist by its stored cart flag. When the user requests a live cart check for a TikTok creator, call `get_creator_detail`:

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
