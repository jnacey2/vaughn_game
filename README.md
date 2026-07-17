# Void Dynasty

A web-based, space-opera trading card game. Illustrated 2D cards, a Hearthstone-style
animated board, spaceship-vs-spaceship combat, and a family-drama story about two rival
Great Houses. Play locally against a rule-based bot today; the engine is architected so a
real multiplayer server can be added later without a rewrite.

See [`docs/game-design.md`](docs/game-design.md) for the full rules reference and
[`docs/lore.md`](docs/lore.md) for the setting/story bible.

## Project layout

This is an npm-workspaces monorepo:

- [`packages/engine`](packages/engine) — framework-agnostic game engine (TypeScript, no
  DOM/network dependency). Owns game state, turn structure, card data, combat resolution,
  and win conditions. This is the single source of truth for the rules and is unit tested.
- [`packages/bot`](packages/bot) — rule-based bot AI that plays through the engine's public
  action API (the same API a human player or, eventually, a network player would use). Ships
  with three difficulty tiers (Easy, Normal, Hard); see [`packages/bot/src/index.ts`](packages/bot/src/index.ts)
  for the heuristics behind each.
- [`apps/web`](apps/web) — the React + TypeScript + Vite client: deck select (choose a House
  and a bot difficulty), an animated "roll for initiative" screen that decides who goes
  first, the animated board, hand, captain panels, and game-over screen.

Because the client and bot both talk to the engine through the same `applyAction` /
`getLegalActions` API, a future multiplayer server can wrap the exact same engine package
server-authoritatively instead of duplicating rules logic.

## Getting started

```bash
npm install
npm run dev        # starts the Vite dev server for apps/web
```

Then open the printed local URL and pick a House to play a full match against the bot.

### Testing

```bash
npm test           # runs engine + bot unit/simulation tests (vitest)
```

The bot package includes a simulation test that plays out many full bot-vs-bot matches to
confirm games always terminate with a winner.

### Building

```bash
npm run build       # typechecks + builds packages/engine, packages/bot, apps/web
```

The web app's production build output is written to `apps/web/dist`.

## Deploying to Render

This repo includes a [`render.yaml`](render.yaml) Blueprint that deploys `apps/web` as a
Render **Static Site** (no backend service is needed for the MVP — the bot runs entirely in
the browser):

1. Push this repo to GitHub/GitLab.
2. In the Render dashboard, choose **New > Blueprint** and point it at this repo. Render will
   read `render.yaml` automatically.
3. Render runs `npm install && npm run build --workspace=apps/web` from the repo root (so npm
   workspaces resolves `packages/engine` and `packages/bot` correctly) and publishes
   `apps/web/dist` on its global CDN, with SPA-style rewrites so client-side routing works.

No environment variables or database are required for the MVP. When real multiplayer is
added (see `docs/game-design.md` "out of scope" section), that will need a second Render
service (a Node/WebSocket web service) added to `render.yaml`.

## Art

Captain portraits and flagship ship art are AI-generated illustrations checked into
`apps/web/public/art`. Every other MVP card uses a procedural gradient placeholder (see
`apps/web/src/components/CardView.tsx`) — swapping in real illustrations later is just a
matter of adding an entry to `apps/web/src/game/cardArt.ts` and dropping the image into
`apps/web/public/art`.
