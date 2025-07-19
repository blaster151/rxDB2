# rxDB2

A modern, reactive database library with TypeScript support.

## Features

- Reactive data with automatic updates
- Pluggable storage backends
- Schema validation with Zod
- Live queries
- Sync capabilities
- Migration support

## 🎯 Design Goals

- **First-class TypeScript schema definition** (Zod, as const, or infer-from-usage)
- **Strong inferred types** for queries, mutations, change events
- **Reactively composed queries** without full RxJS boilerplate (e.g., `.live()`, `useQuery()`)
- **Composable storage and sync layers** (e.g., IndexedDB, SQLite, Git, CRDT)
- **Optional sync, conflict resolution, and schema migration**, not bundled in one rigid stack

## 📘 Conceptual Modules

| Area | Purpose |
|------|---------|
| **core** | Define collections, schemas, DB interface |
| **storage** | Abstract persistence layer (e.g., IndexedDB) |
| **reactive** | Core reactivity: live queries, subscriptions |
| **sync** | Optional syncing (Git, CRDT, etc.) |
| **migration** | Schema versioning and transformation support |
| **plugins** | First-party add-ons (hooks, devtools, adapters) |

## 🧠 Package Philosophy

- **Composable primitives** — you can use just the DB layer or add sync later
- **TS-first everywhere** — schemas, documents, queries, sync
- **Zero-dependency core** — start with only Zod or your own validation
- **Runtime-optional types** — define schema in TS, infer from that if needed
- **Optional reactivity layer** — signals, observables, or hooks (your choice)

## Getting Started

```bash
npm install
npm run test
```

## Project Structure

- `src/core/` - Core database functionality
- `src/storage/` - Storage backends
- `src/reactive/` - Reactive data layer
- `src/sync/` - Synchronization adapters
- `src/migration/` - Schema migration tools
- `plugins/` - Community plugins
- `examples/` - Example applications 