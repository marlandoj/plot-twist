# Redis schema

Redis holds only attempts, leaderboards, streaks and the day queue. Puzzle content is never
stored: every player rebuilds the day from `postData` (`{game, date, roll, guest?}`) with
`buildCandidate()`, so the same date always gives the same street.

Implemented in `src/server/core/keys.ts`; all access goes through the `Store` port
(`src/server/core/ports.ts`) so tests run against an in-memory fake.

| Key | Type | Contents | Written by |
| --- | --- | --- | --- |
| `pt:day:{date}` | hash | `date`, `roll`, `stats` (JSON `DayStats`: optimum, perfectCount, greedyScore, gates, rejections), `guest` (JSON, optional), `postId`, `promptCommentId` | `ensureDay`, `publishDay`, `approveSuggestion` |
| `pt:queue` | zset | member = date, score = epoch day. The validated queue, kept 14 days ahead | `writeDay` |
| `pt:attempt:{date}:{user}` | string | JSON `{placement, result, streak, flair, newFlair}`. First lock-in only; one attempt per day | `submitTown` |
| `pt:lb:{date}` | zset | member = username, score = `met * 3600001 + (3600000 - timeMs)`: more wishes first, then faster | `submitTown` |
| `pt:perfect:{date}` | string (counter) | Number of players who built a perfect town today | `submitTown` |
| `pt:posted:{date}:{user}` | string | `1` once the player's town is posted as a comment | `postTown` |
| `pt:streak:{user}` | hash | `current`, `best`, `lastDate`, `perfectStreak` | `submitTown` |
| `pt:week:{YYYY-Www}` | zset | member = username, score = perfect towns that ISO week (Mayors Wall source) | `submitTown` |
| `pt:sugg:{id}` | string | JSON `Suggestion` (author, body, votes, status, parsed guest, scheduledFor) | `ingestSuggestions`, `approveSuggestion`, `rejectSuggestion` |
| `pt:sugg:pending` | zset | member = suggestion id, score = comment votes (curation queue, top-voted first) | `ingestSuggestions` |
| `pt:sugg:approved` | zset | Approved suggestions still waiting for a fair day, score = approval time | `approveSuggestion` |

Derived values on the result card:

- **players** = `ZCARD pt:lb:{date}`
- **% found a perfect town** = `pt:perfect:{date} / players`
- **percentile** ("better than X%") = `ZRANK pt:lb:{date} user / (players - 1)`
- **streak** = `pt:streak:{user}.current` after `advanceStreak()` (consecutive UTC days; a gap resets to 1)
