# Contributing to Archirift

Thanks for helping. The most valuable contributions are accurate, well-designed levels.

## Before you start

- Read the learning rules in the PRD: every level has the four beats (pain, play, proof, recall), a Blank Blueprint, and a "when not to use it" note. CI enforces these.
- Company names in stories are always fictional.
- Explanations are original; link to books and articles, never copy them.

## Adding or editing content

1. Concepts and relationships live in `content/graph/concepts.yaml` and `content/graph/edges.yaml`. Edge types come from a fixed list in `src/content/schema.ts`.
2. A level is a folder in `content/levels/<level-id>/` containing `level.yaml`. The [level-writing guide](docs/WRITING-LEVELS.md) covers the format, every stage type and how to tune simulator levels.
3. Run `npm run validate-content` to check your changes, and `npx playwright test e2e/rifts.spec.ts -g "<level-id>"` to play your level end to end.

## Code changes

- Engines in `src/engine/` are pure TypeScript with no access to the page.
- All reads and writes of learning data go through the `LearningRepository` interface in `src/persistence/`. Never use IndexedDB or `localStorage` directly from components.
- Any change to the IndexedDB schema adds a new Dexie `version()` with an upgrade step and a migration test.
- Run `npm run check` and `npx playwright test` before opening a pull request.

## Reviews

Each level needs two approvals: one for technical accuracy and one for learning design.
