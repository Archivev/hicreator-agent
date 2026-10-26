# Twitter / X search

Use `platform: "twitter"` for `search_creators_ai` and `find_similar_creators`. Each accepts `limit` 1–100 (default 40). Similar search uses `target_account` instead of `query`; accept `https://x.com/handle`, `https://twitter.com/handle`, or a handle.

```json
{
  "platform": "twitter",
  "query": "Independent developers sharing practical software-building advice",
  "limit": 10,
  "filters": {
    "regions": ["US", "GB"],
    "minFollowers": 1000,
    "twitter": {
      "accountTypes": ["person"],
      "viewCountMetric": "median",
      "minViewCount": 1000,
      "originalPublishedWithinDays": 30
    }
  }
}
```

Common country, excluded-country, language, follower-count, gender, ethnicity, and Workspace deduplication filters still apply. Supported nested `twitter` filters:

- `accountTypes`: person, brand, company, media, organization, community, aggregator, bot, unknown.
- `ageRanges`: use the tool's advertised values; `not_applicable` is a meaningful value for non-person accounts.
- `viewCountMetric`: average or median (default average), with `minViewCount` / `maxViewCount`.
- `minFollowingCount` / `maxFollowingCount`.
- `originalPublishedWithinDays`: 1–30; `activeWithinDays` and `capturedWithinDays`: 1–365.

Do not use `minPlayCount`, `maxPlayCount`, `playCountMetric`, `creatorTypes`, or `faceVisibilities` for Twitter. Do not send `filters.twitter` for video platforms. Prefer structured fields to embedding numeric constraints only in the query.

Twitter views are sampled original-post impressions, not video plays or unique viewers. Activity time, original-post publication time, and profile capture time are different signals. A search may return fewer than the requested limit; describe that result rather than silently issuing another paid search. Native Twitter search uses the existing public synchronous API; it does not promise the product's asynchronous multi-direction search/review workflow or force a profile refresh.
