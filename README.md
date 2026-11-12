# Plot Twist

A daily tiny-town placement puzzle for Reddit (Devvit Web). Everyone gets the same street,
the same 5 buildings and the same 5 residents with spoken wishes. Tap lots to build, watch
their faces, open the town, and compare grades in the comments.

## Layout

Follows the official `devvit-template-react` structure (Devvit 0.15.3):

- `src/shared`: game engine shared by client and server: grid, the 12 wish rules, solver,
  seeded generator with fairness gates, scoring, streaks, flair, emoji town map, suggestion grammar
- `src/client`: React UI (`game.html`, the inline post entry), SVG paper-diorama art
- `src/server`: Hono server: `/api/*` for the game and `/internal/*` for menu, form, trigger and
  scheduler endpoints. Logic lives in `src/server/core` behind small ports
- `data/queue.json`: 14-day validated queue with per-day stats (`npm run queue -- <startDate>`)
- `docs/REDIS.md`: Redis schema
- `tests`: vitest suite (`npm test`)

## Commands

```bash
npm install
npm test              # full suite: rules, solver, generator, fairness gates, queue proof, scoring,
                      # streaks, flair, grammar, server flows, devvit.json, headless playthrough
npm run playthrough   # scripted full round, verbose log
npm run test:types    # tsc --build
npm run queue -- 2026-11-12
npm run bundle-report # vite build + sizes
npm run login         # devvit login (needs the owner's Reddit account)
npm run preview       # standalone web preview (preview/standalone.ts): the real client + core
                      # logic on in-memory ports, for playtesting outside Reddit
npm run dev           # devvit playtest <test subreddit>
npm run deploy        # types + tests + devvit upload
```
