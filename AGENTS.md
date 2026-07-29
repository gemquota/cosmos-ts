# COSMOS-TS — Agent Instructions

This monorepo contains four TypeScript packages under `packages/`.

## Packages

### `packages/space/` — Prompt Engineering Tool
Multi-probe question framework. TypeScript, ported from the original @gemquota/space package.

### `packages/mykb/` — Knowledge OS
Ported from Python. Wiki server, search, index builder, tree builder.

### `packages/rsis3/` — Cognitive Engine
Ported from Python. Three-loop RSI architecture (L1–L3).

### `packages/dashboard/` — Visualization
TypeScript dashboard with Vite/Rolldown build.

## Build
```bash
npm install
npm run build   # builds all packages
```

## Architecture
- `packages/core/` provides shared types used by all other packages
- Each package is self-contained with its own tsconfig
- Dashboard depends on all other packages
