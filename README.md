# Archirift

**Build it. Break it. Scale it.**

Archirift is a free, open-source browser game for learning low-level design (LLD) and high-level design (HLD). Every badly designed system tears a rift in the city: you watch it break, fix it with your own hands, and prove you understand it in interview boss fights. Spaced review and rebuild-from-memory exercises make it stick.

> **Status: Milestone 1 (one exceptional lesson).** *The If-Else Hydra* is playable end to end. See the [product requirements document](https://claude.ai/code/artifact/7c1f2d5d-46e4-4d1f-9225-25c6bc636fa6) for the full plan.

## What works today

- **The If-Else Hydra** (Strategy pattern): feel the pain of an if-else billing chain, refactor it move by move while real client tests run, prove it under a rush of new offers, answer an interviewer, then rebuild the design from memory. Story, Blueprint and Code views (TypeScript and Java) stay in sync with your design. The level saves itself and resumes exactly where you left off.
- Content-driven levels: a level is a folder of YAML under `content/levels/`, validated in CI.
- Knowledge graph of concepts and typed relationships in `content/graph/`.
- Memory engine spike: FSRS scheduling rated from performance, not self-rating.
- Persistence foundation: progress and exercise state save automatically to IndexedDB, with duplicate-proof events, versioned snapshots, stale-write protection and recovery from corrupted saves.
- Your first review of Strategy is scheduled with FSRS from how well you rebuilt the design.
- Diagram lab: an editable Strategy-pattern class diagram that restores your layout after a reload.

Progress is saved **on this device only**. Cross-device sync is planned for v1.5 and is not available yet.

## Run it locally

Requires Node.js 22.12 or newer (24 LTS recommended).

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # content validation, types, lint, unit tests
npm run check:java   # compiles and runs the Java shown in the Code lens (needs a JDK)
npm run build        # static export into out/
npx playwright install chromium
npx playwright test  # end-to-end and accessibility tests against out/
```

## Project layout

| Path | What lives there |
| --- | --- |
| `content/` | Levels and the knowledge graph (text files contributors edit) |
| `src/content/` | Content schemas, loader and cross-file validation |
| `src/engine/` | Pure TypeScript engines: seeded randomness, memory scheduling, graph diff |
| `src/levels/` | Playable levels: domain, design model, behaviour harness, UI |
| `src/persistence/` | The repository interface and its IndexedDB implementation |
| `src/app/` | Pages (Next.js App Router, static export) |
| `e2e/` | Playwright tests that run against the exported site |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

Code is released under the [MIT License](LICENSE). Learning content in `content/` is released under [CC BY 4.0](content/LICENSE).
