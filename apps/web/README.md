# Void Dynasty — web client

React + TypeScript + Vite client for Void Dynasty. See the [repo root README](../../README.md)
for the full project overview, and [`docs/game-design.md`](../../docs/game-design.md) /
[`docs/lore.md`](../../docs/lore.md) for the rules and setting.

```bash
npm run dev      # from the repo root, or `npm run dev` here directly
npm run build
npm run lint
```

This app depends on the `@void-dynasty/engine` and `@void-dynasty/bot` workspace packages
(see `../../packages`) — run `npm install` from the repo root first so npm workspaces can link
them.
