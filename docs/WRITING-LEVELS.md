# Writing a level

A level is one YAML file at `content/levels/<level-id>/level.yaml`. The rift engine turns it into the four beats with no level-specific code. Copy a level close to yours (for example `lld-encapsulation` for a refactor, `hld-caching` for a simulator, `hld-design-url-shortener` for a case study) and edit it.

## Skeleton

```yaml
id: hld-example            # lowercase kebab-case; lld- or hld- prefix
title: The Short Title
summary: One or two sentences shown on the map.
world: data                # a world id from content/graph/worlds.yaml
order: 8                   # position on the world's path; unique within the world
difficulty: 2              # 1–3
type: sandbox-sim          # see LevelSchema in src/content/schema.ts
concepts: [my-concept]     # ids from content/graph/concepts.yaml
prerequisites: [caching]
minutes: 10
whenNotToUse: When this idea is the wrong tool.

rift:
  pain:     { scene, prompt, options: [{ text, outcome }], lesson }   # optional code block
  play:     [ ...stages ]
  boss:     { name, taunt, questions: [{ prompt, choices: [{ text, correct, why }] }] }
  recall:   { kind: cloze | blueprint, ... }
  codex:    { oneLiner, analogy, keyPoints, whenToUse, whenNotToUse, interviewTells, pitfalls }
  cards:    [ extra review questions, same shape as boss questions ]
```

## Play stages

| Kind | Use it for | Key fields |
| --- | --- | --- |
| `steps` | A refactor or decision sequence | `steps[].options` (one `correct`), optional `after.code` / `after.diagram` |
| `sort` | Classifying items | up to 4 `buckets`; `items[].bucket` and `why` |
| `order` | Sequences and flows | `items` in the correct order (shown shuffled) |
| `estimate` | Back-of-the-envelope maths | `answer`, `unit`, `working`; `tolerance` (default 2×) |
| `sim` | Sizing an architecture under traffic waves | `knobs`, `start`, `goals`, `waves`, `solution` |
| `lab` | A hands-on widget | `widget`: `hashring`, `bloom`, `token-bucket`, `lru` or `race` |

### Simulator levels

The `solution` must pass every wave, and the `start` configuration must fail at least one; unit tests check both. Tune numbers with a quick script that calls `simulate()` from `src/rift/sim.ts` for each wave and prints latency, errors, cost and the busiest tier. Aim for exactly one sensible answer: the cheapest passing setup should be the lesson, and the obvious "just add servers" fix should blow the budget.

## Rules that validation enforces

- Item ids are kebab-case; exactly one correct option per step, boss question and card.
- Blueprint recall: every reference node is in the palette, and the palette has at least two distractors (nodes not in the reference or `acceptedExtras`). No two arrows between the same pair of nodes.
- Cloze recall: every `[[answer]]` (or its first alternative in `[[a|b]]`) is in the `bank`.
- Every concept and prerequisite id exists; orders are unique within a world.

## Checking your level

```bash
npm run validate-content
npx vitest run src/rift src/content
npm run build && npx playwright test e2e/rifts.spec.ts -g "<level-id>"
```

The end-to-end test plays your level the way a learner would, using the correct answers from the YAML, so a level that can't be finished fails CI.

## Style

- Stories use fictional, Indian-campus-flavoured companies (CampusKart, SnackBox, FeePay…). Never real company names as the victim.
- Plain words; explain every term the first time. Numbers should be realistic.
- Wrong options must be plausible, and each `feedback` or `why` teaches something.
