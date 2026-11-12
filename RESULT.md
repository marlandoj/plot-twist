# RESULT: Plot Twist (Reddit Game of the Day Hackathon 2026)

## summary

Plot Twist is built as a Devvit Web app (React, SVG, Hono; Devvit 0.15.3, laid out like the official `devvit-template-react`) and it is ready to upload. Everyone gets the same seeded 6 x 4 street, 5 buildings and 5 residents with 1 to 2 spoken wishes, drawn from 12 wish rule types. Wish feedback updates live as you place buildings, and the round ends on a single result card. An exact branch-and-bound solver works out the best possible town. Fairness gates re-roll any day that fails them, and a 14-day queue has been generated with stats recorded for each day; every day passes all gates, and the test suite re-checks this from the recorded numbers and by re-solving each day. The Redis schema, the four Journeys events, the daily-rollover and Mayors Wall scheduler jobs, community resident intake and curation, streak flair, and the Post my town and Subscribe actions are all built and tested against in-memory fakes. `npm test` passes 116 of 116 tests. One full round was played end to end two ways: headless in jsdom, and in a real headless Chrome. **It has not been uploaded.** `devvit upload`, test-subreddit install and demo post creation all need Marlando's Reddit login (see "Next step that needs Marlando").

## files_changed

All new; the repo was created from scratch with `git init`. committed in stages on `main`.

- Root: `package.json`, `package-lock.json`, `devvit.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tools/tsconfig.*.json` (from the official template), `.gitignore`, `.prettierrc`, `LICENSE`, `README.md`, `STRETCH.md`, `RESULT.md`
- `src/shared/`: `catalog.ts`, `grid.ts`, `rng.ts`, `types.ts`, `rules.ts` (12 rules), `solver.ts`, `generator.ts` (seeded generator, gates, weekday ramp), `scoring.ts`, `streak.ts`, `flair.ts`, `textmap.ts`, `suggestions.ts` (wish grammar), `api.ts`
- `src/server/`: `index.ts`, `routes/api.ts`, `routes/internal.ts` (menu, form, trigger, scheduler), `core/ports.ts`, `core/keys.ts`, `core/days.ts`, `core/game.ts`, `core/community.ts`, `core/devvit.ts` (adapters for Devvit redis, reddit and Journeys telemetry)
- `src/client/`: `game.html`, `game.tsx`, `App.tsx`, `state.ts`, `Board.tsx`, `ResultCard.tsx`, `art.tsx`, `platform.ts`, `styles.css`, `module.d.ts`
- `data/queue.json` (14-day validated queue), `docs/REDIS.md`, `scripts/generate-queue.ts`, `scripts/bundle-report.ts`
- `tests/`: `rules`, `solver`, `generator`, `queue`, `scoring`, `suggestions`, `server`, `config` and `playthrough` test files, plus `support/fakes.ts`

## tests_run

- `npm test` at the repo root: **9 files, 116 tests, all passed** (about 22 s). By file: rules 18, solver 4, generator 12, queue 29, scoring 12, suggestions 21, server 16, config 3, playthrough 1.
- `npx tsc --build` (client, server, shared, vite projects): clean.
- `npm run bundle-report`: build succeeds (sizes below).

---

## Deliverables, item by item

### 1. Playable Devvit Web app: done
- There is one inline entry point, `game.html`, shown at `"height": "tall"` with `inline: true`. Nothing has to be expanded first: the post itself is the game.
- **Placement loop** (`src/client/state.ts`; the UI and the playthrough share this same pure code):
  - Tap a lot to place the building currently in hand; the tray then moves on to the next building automatically.
  - Tap a placed building to pick it up, then tap an empty lot to move it. Tap it a second time to put it back in the tray.
  - Landmarks block their lots.
- **First tap and hints:** no instruction screen. A pulsing ghost of the first building marks a suggested lot, and the hint line reads "Tap a lot to build the Café". The first time each rule type breaks, the game explains it in context, for example "Cass frowns. Far = 4+ steps apart, counting along the streets."
- **Live wish feedback:** each wish shows ✓, ✗ or · (still open). Residents' faces show happy, upset or neutral, both in the wish list and on their building on the board.
- **Grades:** Perfect Town (every wish granted), then A (≥85%), B (≥70%), C (≥50%), D. The server re-validates and re-scores every town; it never trusts a score sent by the client.
- **Look:** warm paper diorama with cream paper, ink outlines and one accent colour per building type. There are 12 hand-drawn SVG buildings, 5 landmarks, and faces with 5 skin tones, 6 hair colours, 4 hair styles, 4 accessories and 3 moods. Light and dark mode both work (`prefers-color-scheme`), and reduced-motion is respected.
- **Checked in a real browser:** headless Chrome at 390 px wide, light and dark. The page was usable 267 to 351 ms after navigation on localhost, with zero console or page errors. One problem found and fixed: emoji in the UI chrome (🔥, ⏱) showed as blank boxes in a browser without an emoji font, so they are now SVG icons. The screenshots were scratch output and are not in the repo.

### 2. Generator, solver and fairness gates, with tests and a 14-day queue: done
- **Solver** (`solve`): exact branch-and-bound over every way to put the 5 buildings on the free lots. It returns the optimum and the exact number of distinct perfect towns. Tests compare it against an unpruned brute-force count on 3 puzzles.
- **Greedy baseline:** places buildings in resident order, each on the lot that gives the most granted minus broken wishes so far, and never moves a building afterwards.
- **Gates** (`checkGates`, a pure function over the recorded numbers). A day is kept only if all four hold:
  1. A perfect town exists: optimum equals the wish count.
  2. At least 3 distinct perfect towns exist.
  3. The greedy town scores between 60% and 85% of the optimum.
  4. The number of perfect towns falls inside that weekday's band. This is what enforces the Monday-easiest to Sunday-hardest ramp, together with more wishes and more tricky rule types later in the week.
- **Re-rolls:** `generateDay` tries up to 400 rolls per date and records how many rolls each gate rejected.
- **Proof the queue is fair:** `tests/queue.test.ts` evaluates the gates from the stats stored in `data/queue.json`. It then rebuilds each day from its seed and roll, re-solves it, and checks that optimum, perfect count and greedy score match the recorded values, and that the recorded example town really scores perfect.

| date | weekday | roll | wishes | optimum | perfect towns | greedy | rejected rolls | gates |
|---|---|---|---|---|---|---|---|---|
| 2026-11-12 | Thursday | 20 | 7 | 7 | 190 | 5/7 (71%) | 20 | all 4 pass |
| 2026-11-13 | Friday | 6 | 8 | 8 | 57 | 6/8 (75%) | 6 | all 4 pass |
| 2026-11-14 | Saturday | 1 | 9 | 9 | 5 | 6/9 (67%) | 1 | all 4 pass |
| 2026-11-15 | Sunday | 11 | 9 | 9 | 30 | 7/9 (78%) | 11 | all 4 pass |
| 2026-11-16 | Monday | 2 | 6 | 6 | 3240 | 5/6 (83%) | 2 | all 4 pass |
| 2026-11-17 | Tuesday | 2 | 6 | 6 | 429 | 5/6 (83%) | 2 | all 4 pass |
| 2026-11-18 | Wednesday | 5 | 7 | 7 | 1013 | 5/7 (71%) | 5 | all 4 pass |
| 2026-11-19 | Thursday | 3 | 7 | 7 | 44 | 5/7 (71%) | 3 | all 4 pass |
| 2026-11-20 | Friday | 0 | 8 | 8 | 64 | 6/8 (75%) | 0 | all 4 pass |
| 2026-11-21 | Saturday | 5 | 9 | 9 | 5 | 7/9 (78%) | 5 | all 4 pass |
| 2026-11-22 | Sunday | 8 | 9 | 9 | 131 | 7/9 (78%) | 8 | all 4 pass |
| 2026-11-23 | Monday | 0 | 6 | 6 | 660 | 5/6 (83%) | 0 | all 4 pass |
| 2026-11-24 | Tuesday | 2 | 6 | 6 | 404 | 5/6 (83%) | 2 | all 4 pass |
| 2026-11-25 | Wednesday | 8 | 7 | 7 | 46 | 5/7 (71%) | 8 | all 4 pass |

Each day's `postData` is `{game, date, roll, guest?}`, under 100 bytes; the Devvit limit is 2 KB. The client rebuilds the day from it instantly, with no solving.

### 3. Redis, Journeys and scheduler: done (tested with fakes; not yet run on Reddit)
- **Redis:** the schema is in `docs/REDIS.md` and implemented in `src/server/core`. It covers attempts (one per user per day), the daily leaderboard as a sorted set (more wishes first, then faster time), perfect-town counters, streak hashes, weekly Mayors sorted sets, the day queue and the suggestion queues. No puzzle content is stored.
- **Journeys:** wired through `@devvit/analytics/server/reddit`, which I found to be the 0.15.3 Journeys SDK, with `permissions.journeys` enabled.
  - `session_start`: `startJourney` plus an interaction, on `/api/init`.
  - `first_placement`, `town_opened`, `result_posted`: interaction plus progress, sent via `/api/event`.
  - `endJourney({complete, game:{win, score}})` fires on lock-in.
- **Scheduler** (`devvit.json`):
  - `daily-rollover` at `0 0 * * *` keeps the queue 14 days ahead, takes in suggestions from yesterday's pinned prompt, schedules approved guests, and creates today's post with its pinned prompt comment and help-thread comment.
  - `mayors-wall` at `15 0 * * 1` posts last ISO week's perfect-town builders.
- **Install:** `onAppInstall` publishes the first day. There is also a mod menu item, "post today's street".
- **Community residents (non-negotiable 5):** replies to the pinned prompt are parsed against the wish grammar ("Name the building: wish. wish.", `src/shared/suggestions.ts`). Replies that fit go into a curation queue ordered by votes. A mod menu item and form let the operator approve or reject. On approval, the guest goes into the first free day within 7 days, that day is regenerated through the same gates, and the resident shows "suggested by u/…" in the game and in the teaser.
- `devvit.json` is validated by the SDK's own `parseAppConfig` in `tests/config.test.ts`.

### 4. The single result card: done
- **Contents:** a 300 px town snapshot (SVG), the grade, wishes granted, % of players who found a perfect town, percentile, time, a streak counter (with flair when earned), and a teaser for tomorrow's resident.
- **Exactly two actions:** **Post my town** and **Subscribe**.
  - Post my town comments as the user (`runAs: 'USER'`, `SUBMIT_COMMENT` scope). The comment is the guaranteed text-and-emoji map: 4 rows of 6 symbols, no code block, so it reads well in a 300 px column.
  - Subscribe calls `subscribeToCurrentSubreddit()` (`SUBSCRIBE_TO_SUBREDDIT` scope).
- **Not done:** image comments (see STRETCH.md).
- Reopening the post after locking in shows the same card.

### 5. Flair milestones: done
`src/shared/flair.ts` defines the streak milestones: Resident at 3 days, Mayor at 7, Town Planner at 14, City Founder at 30 and Plot Legend at 100. The flair text reads, for example, "Mayor, 7-day streak". `setUserFlair` is called only when a milestone is crossed. A streak counts consecutive UTC days with a locked-in town; a missed day resets it to 1. All of this is tested.

### 6. Local verification evidence: done

**npm test:** 116/116 pass (see tests_run).

**Scripted playthrough** (`npm run playthrough`, `tests/playthrough.test.tsx`). This is the real React app in jsdom, with its platform calls routed into the real server core over fake Redis, Reddit and Journeys. Two other players had already played that day. Output:
```
ready in 133ms (jsdom), hint: "Tap a lot to build the Café"
street: 2026-11-12 (well@2, oak@9, pond@14)
  Bram the barista: "A corner lot for my café, please."
  Cass the mechanic: "My garage should be on the edge of town." "Keep the clinic far from my garage."
  Ines the doctor: "I want my clinic beside the wishing well." "Put my clinic right beside the daycare."
  Wren the nanny: "Keep the garage far from my baby."
  Ottilie the launderer: "Put my laundromat on a corner."
tap lot 0 -> Café ... tap lot 5 -> Garage ... tap lot 1 -> Clinic ... tap lot 7 -> Daycare ... tap lot 18 -> Laundromat
  final wishes met,met,met,met,met,met,met; hint "Everyone has a home. Happy with it? Open the town!"
result card: grade "Perfect Town!", found a perfect town 67%, better than 100%, time 1:30, streak 1,
  teaser "Tomorrow · Friday — Bram the bookseller is moving in…", snapshot width 300,
  actions ["Post my town","Subscribe"]
posted comment:
**Plot Twist 2026-11-12** · Perfect Town · 7/7 wishes · 1:30
☕🏥🪣🟩🟩🔧
🟩🧸🟩🌳🟩🟩
🟩🟩🦆🟩🟩🟩
🧺🟩🟩🟩🟩🟩
💚💚💚💚💚💚💚
journey events: session_start -> first_placement -> town_opened -> result_posted; ended {"win":true,"score":7}
```
I also played the round in headless Chrome against the production bundle, using a scratch harness kept outside the repo. That run included one deliberately wrong placement and moving the building to fix it. The result card showed in light and dark mode, and reloading the post showed the same card again.

**Bundle and load:**

| file | raw | gzip |
|---|---|---|
| `client/default.js` (React 19 plus game) | 247 KB | 77 KB |
| `client/default.css` | 5 KB | 2 KB |
| `server/index.cjs` | 2.1 MB | 456 KB |

- No game engine, no fonts, no images: all art is inline SVG.
- First tap was ready 267 to 351 ms after navigation on localhost. This was not measured on Reddit's CDN or a phone, so the "about 1 second" target is not confirmed there.
- Day generation on the server averages about 57 ms per candidate roll. The whole 14-day queue took 3.3 s.

### 7. Upload readiness: ready to upload; the upload itself was not done
- **Done:**
  - Followed the current official quickstart template (`devvit-template-react` from `developers.reddit.com/templates.json`, Devvit 0.15.3).
  - The Devvit CLI runs: `@devvit/cli/0.15.3`.
  - `vite build` with `@devvit/start/vite` produces `dist/client` and `dist/server/index.cjs`.
  - `devvit.json` passes the SDK parser.
- **Blocked:** `npx devvit whoami` returns "Not currently logged in". I did not create, and have not claimed, any app listing, subreddit, demo post or playtest result.

## Not done, and why
- **Upload, test subreddit, playtest on Reddit, demo post:** these need Marlando's interactive Reddit and Devvit login.
- **Behaviour on real Reddit:** the Journeys calls, user-scoped commenting and subscribing, flair, the scheduler and comment ingestion are all tested only against fakes. They have never run on Reddit.
  - Journeys may return "not allowlisted" receipts until Reddit enables the app. The code ignores telemetry failures, so gameplay is not affected.
  - User-scoped actions (`asUser`) may need Reddit's approval for the app.
- **Image comments:** cut to STRETCH.md. The text-and-emoji map ships instead, as the brief allowed.
- **Suggestion approval is manual**, through the mod menu. The brief accepted this for the MVP.
- **`tests/config.test.ts` imports `@devvit/shared-types` and `@devvit/protos` indirectly**, through `@devvit/web` 0.15.3 (pinned), rather than as direct dependencies.

## Next step that needs Marlando
Run these from the repo root. Each needs his interactive Reddit login or his ownership of a subreddit:
```bash
npm install
npm test                      # expect 116 passed
npx devvit login              # opens the browser: log in to Reddit as Marlando
npx devvit upload             # creates/updates the private app "plot-twist" (rename in devvit.json if taken)
npx devvit playtest r/<a test subreddit he moderates>   # installs it; the onAppInstall trigger posts today's street
```
Then, in that subreddit:
1. If no post appeared, use mod menu → "Plot Twist: post today's street".
2. Play the post on mobile and desktop.
3. Use the resulting post URL as the Devpost demo link.

When it is ready to publish: `npx devvit publish`.

## lessons
- failed: emoji used in UI chrome (🔥 streak, ⏱ clock) rendered as blank boxes in headless Chrome, which has no emoji font
  fix: drew FlameIcon and ClockIcon as inline SVG in src/client/art.tsx and kept emoji only in the comment text map
  verified: re-captured headless Chrome screenshots at 390px and the icons rendered; npm test 116/116
  evidence: src/client/art.tsx
  topic: devvit web, emoji font, svg icons, polish
- failed: tests/config.test.ts expected Devvit asUser scopes as strings, but parseAppConfig returns proto enum numbers
  fix: compared against Scope.SUBMIT_COMMENT and Scope.SUBSCRIBE_TO_SUBREDDIT from @devvit/protos
  verified: npx vitest run tests/config.test.ts passed 3/3
  evidence: tests/config.test.ts
  topic: devvit.json, parseAppConfig, permissions
