# Archirift

**Build it. Break it. Scale it.**

Archirift is a free, open-source browser game for learning low-level design (LLD) and high-level design (HLD), from your first class to a full "Design WhatsApp" interview. Every badly designed system tears a rift in the city: you watch it break, fix it with your own hands, prove you understand it in an interview boss fight, and rebuild it from memory. Spaced review makes it stick.

> **Status:** 79 playable levels across 12 worlds. See the [product requirements document](https://claude.ai/code/artifact/7c1f2d5d-46e4-4d1f-9225-25c6bc636fa6) for the full plan.

## The course

| Track | World | What you learn |
| --- | --- | --- |
| LLD | **Object Foundry** | Classes and objects, encapsulation, abstraction, inheritance, polymorphism, composition, UML class diagrams, relationships and sequence diagrams |
| LLD | **Hall of Laws** | SRP, Open/Closed, Liskov, Interface Segregation, Dependency Inversion, DRY/KISS/YAGNI |
| LLD | **Creational Forge** | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| LLD | **Structural Bridges** | Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight |
| LLD | **Behavioral Arcade** | Strategy (the If-Else Hydra), Observer, State, Command, Template Method, Iterator, Chain of Responsibility, Mediator, Memento, Visitor |
| LLD | **Engine Room** | Race conditions, deadlocks, producer–consumer |
| LLD | **Machine Coding Agency** | Parking lot, elevator, Splitwise, BookMyShow, LRU cache, tic-tac-toe |
| HLD | **Scaling City** | The request journey, horizontal scaling, load balancing, caching, CDNs, capacity estimation |
| HLD | **Data District** | SQL vs NoSQL, indexing, replication, sharding, consistent hashing, CAP, consistency models and quorums |
| HLD | **Messaging Harbor** | Message queues, pub/sub and Kafka, real-time transports, idempotency and the outbox pattern |
| HLD | **Reliability Citadel** | Rate limiting, circuit breakers, microservices, sagas and 2PC, Raft consensus, Bloom filters, API design |
| HLD | **Interview Arena** | The interview framework, then TinyURL, WhatsApp, news feed, notifications, YouTube, Uber, autocomplete and a web crawler |

Each level follows the same four beats:

1. **Pain**: a short story where a bad design breaks something.
2. **Play**: fix it yourself, through refactor steps with live code and diagrams, sorting, ordering and back-of-the-envelope estimates, a traffic **simulator** where you size servers, caches, replicas, shards, queues, rate limiters and circuit breakers, and hands-on **labs** (hash ring, Bloom filter, token bucket, LRU, thread race).
3. **Proof**: an interview boss fight.
4. **Recall**: rebuild the architecture or fill in the key ideas from memory. Every level then adds a Codex cheat sheet and review cards scheduled with FSRS.

## Features

- XP, eight ranks from Intern to Chief Architect, daily streaks, achievements, a review queue and a Boss Rush arena.
- **Accounts (optional):** sign in with Google or email and password to keep progress in the cloud across devices; guest progress is adopted on first sign-in. Firebase setup is described in [docs/ACCOUNTS.md](docs/ACCOUNTS.md). Without Firebase configuration, the app runs fully offline with progress saved on the device.
- An opt-in leaderboard.
- Light and dark themes, reduced-motion support, keyboard play, and automated accessibility audits.

## Run it locally

Requires Node.js 22.12 or newer (24 LTS recommended).

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # content validation, types, lint, unit tests
npm run build        # static export into out/
npx playwright install chromium
npx playwright test  # plays every level end to end, plus accessibility tests, against out/
```

On Windows, `powershell -File scripts/verify.ps1 [-Grep "hld-"]` builds and runs the end-to-end tests in an isolated copy, so a running `npm run dev` is never disturbed.

## Project layout

| Path | What lives there |
| --- | --- |
| `content/` | Levels (YAML) and the knowledge graph (text files contributors edit) |
| `src/content/` | Content schemas, loader and cross-file validation |
| `src/rift/` | The rift engine: level state, simulator, labs, and their UI |
| `src/engine/` | Pure TypeScript engines: seeded randomness, memory scheduling, graph diff |
| `src/levels/` | Hand-built levels (the If-Else Hydra) |
| `src/game/` | Ranks, achievements, catalog and review deck |
| `src/persistence/` | The repository interface and its IndexedDB implementation |
| `src/sync/` | Optional Firebase accounts and cloud sync |
| `src/app/` | Pages (Next.js App Router, static export) |
| `e2e/` | Playwright tests that run against the exported site |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the level-writing guide in [docs/WRITING-LEVELS.md](docs/WRITING-LEVELS.md).

## Licence

Code is released under the [MIT License](LICENSE). Learning content in `content/` is released under [CC BY 4.0](content/LICENSE).
