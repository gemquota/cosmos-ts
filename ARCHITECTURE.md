# COSMOS Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    cosmos-ts (monorepo)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  space    │  │  mykb    │  │  rsis3   │  │  dashboard   │ │
│  │ (prompt   │  │ (memory) │  │ (engine) │  │ (visualizer) │ │
│  │  engine)  │  │          │  │          │  │             │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       └──────────────┴─────────────┴───────────────┘        │
│                            │                                 │
│                    ┌───────┴───────┐                         │
│                    │  @cosmos/core  │                         │
│                    │  (shared types)│                         │
│                    └───────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### `@cosmos/space` — Prompt Engineering Tool
Originally TypeScript. Multi-probe question framework generating structured specification documents. Supports 6 export formats, 7 LLM providers, i18n (en/es/fr), SQLite storage, and CLI + UI interfaces.

### `@cosmos/mykb` — Knowledge OS
Ported from Python. Obsidian-style wiki server with:
- HTTP markdown server with auto-discovery
- TF-IDF search with reciprocal rank fusion
- Frontmatter extraction and indexing
- Hierarchical tree builder for the dashboard explorer
- Knowledge graph analysis

### `@cosmos/rsis3` — Cognitive Engine
Ported from Python. Three-loop recursive self-improvement:
- **L1** — Per-task action loop (plan → tool call → observe → retry)
- **L2** — Per-session improvement loop with evaluation
- **L3** — Cross-session evolution with plateau detection
- Telemetry, checkpointing, resource enforcement, recovery mechanisms

### `@cosmos/dashboard` — Visualization
TypeScript dashboard with Vite build. Shows project cards, stacked bar charts, donut charts, and the MyKB domain explorer.

## Active Triad

`rsis3` + `mykb` + `space` form the core triad:
- **rsis3** = the mind (cognitive engine)
- **mykb** = the memory (knowledge OS)
- **space** = the voice (prompt engineering)

## Package Dependencies

```
dashboard → space, mykb, rsis3, core
space     → core
mykb      → core
rsis3     → core
```
