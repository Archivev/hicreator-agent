# Reverse lookup by email

Call `find_creators_by_email` with `{ "email": "contact@example.com" }`. Exactly one email is accepted. The HTTP equivalent is `POST /openapi/v1/creators/by-email` with the same body.

```json
{
  "requestId": "<request-id>",
  "billingRequestId": "<billing-request-id>",
  "data": {
    "email": "contact@example.com",
    "creators": []
  }
}
```

`data.creators` contains all matching stored profiles in stable `platform`, `id` order. `[]` is a successful no-match response. There is no result cap, truncation flag, pagination, or nested `creator` object. The result is a stored snapshot; it does not trigger live collection, profile enrichment, or mail-contact registration. Requests are independent and billed once per matching email, not per creator. An unmatched email or execution failure is refunded. Do not automatically retry an uncertain paid result.

All creator fields below are always present. Only `id`, `platform`, and `email` are non-nullable. Other fields are `null` when missing or inapplicable to the platform. Known empty lists remain `[]`. Numeric zero and boolean false are real values. The identity is the pair `platform` + `id`; an ID alone is not unique across platforms.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable platform user/channel ID; use with `platform` for favorites. |
| `platform` | string | `instagram`, `youtube`, `tiktok`, or `twitter`. |
| `username` | string or null | Platform handle. |
| `fullName` | string or null | Display name. |
| `avatarUrl` | URL or null | Public stored avatar. |
| `profileUrl` | URL or null | Creator profile URL; YouTube uses the channel ID. |
| `youtubeChannelUrl` | URL or null | YouTube channel-ID URL; null on other platforms. |
| `youtubeHandleUrl` | URL or null | YouTube @handle URL; null on other platforms. |
| `biography` | string or null | Public biography. |
| `email` | string | Matched normalized public email, equal to `data.email`. |
| `externalLinks` | URL[] or null | Deduplicated public HTTP(S) links from the stored email and profile data. |
| `followerCount` | integer or null | Followers/subscribers. |
| `followingCount` | integer or null | Accounts followed; null for YouTube. |
| `region` | string or null | Creator region. |
| `language` | string or null | Primary content language. |
| `youtubeHasOfficialEmail` | boolean or null | Whether YouTube shows its official email contact button; unknown or other platforms are null. |
| `averagePlayCount`, `medianPlayCount` | number or null | Video-platform play metrics; null for Twitter. |
| `averageViewCount`, `medianViewCount` | number or null | Twitter post-view metrics; null on other platforms. |
| `averageEngagementRate`, `medianEngagementRate` | number or null | Engagement ratios; 0.045 means 4.5%. |
| `gender`, `ageRange`, `ethnicity` | string or null | Profile demographic classifications; unknown/inapplicable values are null. |
| `faceVisibility` | string or null | Face-visibility classification; null for Twitter. |
| `accountType` | string or null | Twitter account type; unknown or other platforms are null. |
| `accountPositioning` | string[] or null | Video-platform positioning labels or Twitter roles. |
| `aiDescription` | string or null | Stored AI creator description. |

The flat field names align with public creator search and Creator Lookup. There is no similarity `score`, since this is an exact email match. Nulls do not authorize a separate paid enrichment call.
