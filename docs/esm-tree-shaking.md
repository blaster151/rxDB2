# ESM Compatibility & Tree-Shaking

This document explains how rxDB2 is structured for optimal ESM compatibility, tree-shaking, and developer experience.

## 🎯 Overview

rxDB2 is built as a modern, tree-shakable ESM library that provides:

- **Tree-shaking**: Unused code is eliminated from final bundles
- **ESM compatibility**: Native ES modules with `.js` extensions
- **Type safety**: Full TypeScript support with export type wrappers
- **Zero side effects**: Safe for bundler optimization

## 📦 Package Structure

### Main Package Exports

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./engine": {
      "types": "./dist/engine/index.d.ts",
      "import": "./dist/engine/index.js",
      "default": "./dist/engine/index.js"
    },
    "./storage": {
      "types": "./dist/storage/index.d.ts",
      "import": "./dist/storage/index.js",
      "default": "./dist/storage/index.js"
    }
  },
  "sideEffects": false
}
```

### Subpath Exports

The library supports granular imports for optimal tree-shaking:

```typescript
// Import only what you need
import { defineCollection } from 'rxdb2/engine'
import { createIndexedDBAdapter } from 'rxdb2/storage'
import { reactive } from 'rxdb2/reactive'

// Or import everything
import { defineCollection, reactive, createIndexedDBAdapter } from 'rxdb2'
```

## 🌳 Tree-Shaking Support

### Static Exports

All exports are static and side-effect free:

```typescript
// ✅ Tree-shakable - only defineCollection included in bundle
import { defineCollection } from 'rxdb2'

// ✅ Tree-shakable - only reactive included in bundle  
import { reactive } from 'rxdb2'

// ❌ Avoid - imports everything
import * as rxdb2 from 'rxdb2'
```

### Self-Contained Operators

All reactive operators are self-contained and don't depend on other operators, enabling optimal tree-shaking:

```typescript
// ✅ GOOD: Self-contained operator - can be tree-shaken independently
export function map<T, U>(source: any, project: (value: T) => U): any {
  const result = reactive(project(source.get()))
  source.subscribe(value => result.set(project(value)))
  return result
}

// ✅ GOOD: Another self-contained operator
export function filter<T>(source: any, predicate: (value: T) => boolean): any {
  const result = reactive(source.get())
  source.subscribe(value => {
    if (predicate(value)) {
      result.set(value)
    }
  })
  return result
}

// ❌ BAD: Operator with dependencies (would prevent tree-shaking)
// import { otherOperator } from './otherOperator'
// export function map<T, U>(source: any, project: (value: T) => U): any {
//   return otherOperator(source, project) // Dependency prevents tree-shaking
// }
```

This ensures that importing only `map` doesn't include `filter` or other operators in the bundle.

### Export Type Wrappers

Types are exported separately to avoid runtime bloat:

```typescript
// ✅ Type-only imports - eliminated at runtime
import type { Collection, InsertResult } from 'rxdb2'

// ✅ Mixed imports - types eliminated, functions included
import { defineCollection, type Collection } from 'rxdb2'
```

## 📁 File Structure

```
src/
├── index.ts                 # Main exports
├── core/                    # Core database functionality
│   ├── db.ts
│   ├── collection.ts
│   └── ...
├── reactive/                # Reactive system
│   ├── observable.ts
│   ├── liveQuery.ts
│   └── ...
├── storage/                 # Storage adapters
│   ├── index.ts
│   ├── indexeddb.ts
│   ├── asyncstorage.ts
│   └── types.ts
└── ...

packages/
└── engine/                  # Reactive engine
    └── src/
        ├── index.ts
        ├── database/
        ├── operators/
        └── ...

plugins/                     # Optional plugins
├── react-hooks/
├── vite-devtools/
└── zod-integration/
```

## 🔧 TypeScript Configuration

### Compiler Options

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### Path Mapping

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/engine/*": ["packages/engine/src/*"],
      "@/storage/*": ["src/storage/*"]
    }
  }
}
```

## 📦 Build Process

### TypeScript Compilation

```bash
# Build with path resolution
npm run build

# Development mode with watch
npm run dev
```

### Bundle Analysis

The library is optimized for modern bundlers:

- **Vite**: Full tree-shaking support
- **Webpack**: Tree-shaking with `sideEffects: false`
- **Rollup**: Optimal tree-shaking
- **esbuild**: Fast compilation with tree-shaking

## 🎯 Usage Examples

### Basic Usage

```typescript
import { z } from 'zod'
import { defineCollection, reactive } from 'rxdb2'

// Define schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
})

// Create collection
const users = defineCollection('users', UserSchema)

// Use reactive features
const liveUsers = users.liveQuery({ name: 'Alice' })
```

### Storage Adapters

```typescript
import { createIndexedDBAdapter } from 'rxdb2/storage'

// Create storage adapter
const storage = createIndexedDBAdapter({
  dbName: 'myapp',
  version: 1
})

// Connect and use
await storage.connect()
await storage.set('key', { data: 'value' })
```

### Type-Only Imports

```typescript
import { defineCollection } from 'rxdb2'
import type { Collection, InsertResult } from 'rxdb2'

// Types are eliminated at runtime
const users: Collection<User> = defineCollection('users', UserSchema)
```

## 🚀 Performance Benefits

### Bundle Size Optimization

- **Tree-shaking**: Eliminates unused code
- **Type elimination**: Type imports removed at runtime
- **ESM**: Better compression and caching
- **Side-effect free**: Safe for bundler optimization

### Runtime Performance

- **ESM**: Faster module loading
- **Static analysis**: Better bundler optimization
- **Modern features**: Leverages latest JavaScript capabilities

## 🔍 Verification

### Tree-Shaking Test

```typescript
// Only this function will be included in the bundle
import { defineCollection } from 'rxdb2'

// Unused imports are eliminated
// import { reactive } from 'rxdb2' // This would be tree-shaken out
```

### Bundle Analysis

Use tools like `rollup-plugin-visualizer` or `webpack-bundle-analyzer` to verify tree-shaking:

```bash
# Analyze bundle size
npm run build:analyze
```

## 📋 Best Practices

### Import Optimization

```typescript
// ✅ Good - specific imports
import { defineCollection, reactive } from 'rxdb2'

// ✅ Good - type-only imports
import type { Collection } from 'rxdb2'

// ❌ Avoid - namespace imports
import * as rxdb2 from 'rxdb2'
```

### Subpath Imports

```typescript
// ✅ Good - import only what you need
import { defineCollection } from 'rxdb2/engine'
import { createIndexedDBAdapter } from 'rxdb2/storage'

// ✅ Good - main import for convenience
import { defineCollection, createIndexedDBAdapter } from 'rxdb2'
```

### Type Safety

```typescript
// ✅ Good - explicit typing
import { defineCollection } from 'rxdb2'
import type { Collection } from 'rxdb2'

const users: Collection<User> = defineCollection('users', UserSchema)

// ✅ Good - inferred typing
const users = defineCollection<User>('users', UserSchema)
```

## 🎉 Summary

rxDB2 provides a modern, tree-shakable ESM library that:

- ✅ Eliminates unused code through tree-shaking
- ✅ Supports native ES modules
- ✅ Provides full TypeScript support
- ✅ Optimizes bundle size and performance
- ✅ Enables granular imports for flexibility
- ✅ Maintains type safety with export type wrappers

This structure ensures optimal developer experience and runtime performance in modern JavaScript applications. 