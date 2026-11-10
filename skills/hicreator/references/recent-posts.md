# Creator recent videos and posts

Call `get_creator_recent_posts` with `{ "profile_url": "https://www.instagram.com/example_creator/" }`. The HTTP equivalent is `POST /openapi/v1/creators/recent-posts` with the same body. Use only a tool actually advertised by the client; if it is missing, reload tool discovery after backend deployment. Do not invent a tool or substitute paid video-detail calls.

The trimmed profile URL is 1–2048 characters and may omit the protocol. Do not send bare handles, IDs, post URLs, arrays, or extra fields such as `limit`, `cursor`, `platform`, `include_video_cart`, `workspaceId`, or `userId`. TikTok requires a direct profile URL; redirecting short links are unsupported.

## Result and sampling

The response is `{ requestId, billingRequestId, data: { platform, canonicalUrl, retrievedAt, items } }`. Each item requires `id`, `url`, and `metrics`. Optional fields include `title`, `text`, `contentType`, `durationSeconds`, `thumbnailUrl`, and `publishedAt`. `contentType` can be post, photo, carousel, video, reel, short, or live; only describe returned types as observed.

| Platform | Window and interpretation |
|---|---|
| Instagram | One initial posts page; may include pinned and collaborative posts. |
| YouTube | One videos page and one Shorts page, requested newest first; likes, comments, and precise timestamps are not guaranteed. |
| TikTok | One page requested with up to 30 items; videos and photos, possibly fewer items or pinned content. |
| Twitter / X | One timeline page requested with 20 items; excludes reposts, retains originals, quotes, and replies; fewer than 20 may remain. |

Items are deduplicated by platform post ID and capped at 60. Only when every item has an exact timestamp are results sorted newest first; otherwise source order is preserved, with YouTube videos before Shorts. Do not promise exhaustive history, chronological completeness, a chosen date range, or the exact latest N posts. There is no cursor or next page. If the user requests videos only, select from returned content types and disclose that the source sample also contains other posts; do not refill with another paid query.

`publishedAt` preserves source precision: `YYYY-MM-DD` or an ISO 8601 timestamp with timezone. Do not invent midnight or infer timestamps from relative age labels. Missing fields are unknown; preserve actual zero values. Metrics can include `viewCount`, `likeCount`, `commentCount`, `shareCount`, `saveCount`, `downloadCount`, `repostCount`, and `quoteCount`, depending on platform and availability. Do not relabel X post views as video plays or sum overlapping metrics.

Optional `platformDetails` can contain `pinned`, `paidPartnership`, `advertisement`, `region`, `postType` (original/reply/quote), and `language`. No cart verdict, contact email, media download URL, or raw provider payload is promised. An absent flag is unknown, not false. A post ID is not a creator ID and cannot be used for favorites.

## Cost and boundaries

Default price is 0.1 credits per successful query, including an empty `items` list; server pricing takes precedence. Failures and timeouts follow the full-refund path. An empty sample does not prove the account has no posts; an error is not an empty sample. Repeated submissions are independently billed. Never automatically retry an uncertain result; preserve `requestId` and `billingRequestId` for investigation.

The query does not save or ingest creators, create background jobs, or follow historical pages. Single-post enrichment via `get_video_detail` is a separate paid operation, limited to its supported platforms, and requires the user's request.
