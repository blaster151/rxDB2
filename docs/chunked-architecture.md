# Chunked Architecture

This document explains how rxDB2 uses a chunked architecture to provide optimal tree-shaking, maintainability, and developer experience.

## 🎯 Overview

rxDB2 is organized into named chunks that can be imported individually or as a complete package. This architecture provides:

- **Optimal tree-shaking**: Only imported chunks are included in bundles
- **Better maintainability**: Clear separation of concerns
- **Flexible imports**: Granular or full imports as needed
- **Improved testing**: Test individual chunks in isolation

## 📁 Chunk Structure

```
src/
├── index.ts                    # Main barrel file (merges all chunks)
├── chunks/
│   ├── reactive.ts             # Reactive primitives & creation utilities
│   ├── coreOperators.ts        # All reactive operators
│   ├── collections.ts          # Collection management
│   ├── storage.ts              # Storage adapters
│   ├── validation.ts           # Schema & validation
│   └── plugins.ts              # Plugin system types
├── storage/                    # Storage implementation
├── core/                       # Legacy collections
└── packages/                   # Engine implementation
```

## 🔧 Individual Chunks

### `reactive.ts` - Reactive Primitives

```typescript
// Core reactive primitives
export { reactive } from '../../packages/engine/src/reactive.js'
export type { Reactive } from '../../packages/engine/src/reactive.js'

// Observable creation
export { createObservable } from '../../packages/engine/src/createObservable.js'

// Creation utilities
export { fromEvent } from '../../packages/engine/src/fromEvent.js'
export { fromWebSocket, sendWebSocketMessage, closeWebSocketConnection } from '../../packages/engine/src/fromWebSocket.js'
export { fromPromise, fromAsync, fromPromiseWithError } from '../../packages/engine/src/fromPromise.js'

// Utility types
export type { LiveQuery } from '../../packages/engine/src/types.js'
```

**Usage:**
```typescript
import { reactive, fromEvent, createObservable } from 'rxdb2/reactive'
```

### `coreOperators.ts` - Reactive Operators

```typescript
// Core operators
export { 
  takeWhile, sample, switchMap, mergeMap, zip, 
  withLatestFrom, combineLatest, delay, pairwise,
  retry, catchError, startWith, scan, tap, concatMap
} from '../../packages/engine/src/operators.js'

// Sharing operators
export { share } from '../../packages/engine/src/share.js'
export { multicast } from '../../packages/engine/src/multicast.js'
```

**Usage:**
```typescript
import { map, filter, scan, switchMap, combineLatest } from 'rxdb2/operators'
```

### `collections.ts` - Collection Management

```typescript
// Modern reactive collections
export { defineCollection } from '../../packages/engine/src/database/defineCollection.js'
export type { Collection, InsertResult, UpdateResult, DeleteResult, QueryResult } from '../../packages/engine/src/database/defineCollection.js'

// Legacy collections
export { defineCollection as defineLegacyCollection } from '../core/collection.js'
export type { CollectionDefinition } from '../core/collection.js'

// Database creation
export { createDatabase } from '../core/db.js'
export type { Database } from '../core/db.js'
```

**Usage:**
```typescript
import { defineCollection, createDatabase } from 'rxdb2/collections'
```

### `storage.ts` - Storage Adapters

```typescript
// Storage adapters
export { createIndexedDBAdapter } from '../storage/indexeddb.js'
export { createAsyncStorageAdapter } from '../storage/asyncstorage.js'

// Storage types
export type { 
  StorageAdapter, StorageOptions, StorageEvent, StorageStats,
  StorageError, ConnectionError, TransactionError, QuotaExceededError
} from '../storage/types.js'
```

**Usage:**
```typescript
import { createIndexedDBAdapter, createAsyncStorageAdapter } from 'rxdb2/storage'
```

### `validation.ts` - Schema & Validation

```typescript
// Re-export Zod for convenience
export { z } from 'zod'
export type { ZodSchema, ZodType, ZodError } from 'zod'
```

**Usage:**
```typescript
import { z } from 'rxdb2/validation'
```

### `plugins.ts` - Plugin System

```typescript
// Plugin system types
export type { Plugin, PluginContext } from '../types.js'
```

**Usage:**
```typescript
import type { Plugin, PluginContext } from 'rxdb2/plugins'
```

## 📦 Package.json Exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./reactive": {
      "types": "./dist/chunks/reactive.d.ts",
      "import": "./dist/chunks/reactive.js"
    },
    "./operators": {
      "types": "./dist/chunks/coreOperators.d.ts",
      "import": "./dist/chunks/coreOperators.js"
    },
    "./collections": {
      "types": "./dist/chunks/collections.d.ts",
      "import": "./dist/chunks/collections.js"
    },
    "./storage": {
      "types": "./dist/chunks/storage.d.ts",
      "import": "./dist/chunks/storage.js"
    },
    "./validation": {
      "types": "./dist/chunks/validation.d.ts",
      "import": "./dist/chunks/validation.js"
    },
    "./plugins": {
      "types": "./dist/chunks/plugins.d.ts",
      "import": "./dist/chunks/plugins.js"
    }
  }
}
```

## 🎯 Import Strategies

### 1. Full Import (Development)

```typescript
import { reactive, map, defineCollection, z } from 'rxdb2'
```

**Pros:**
- Convenient for development
- Single import statement
- Easy to discover APIs

**Cons:**
- Larger bundle size
- Includes all chunks
- Less optimal tree-shaking

### 2. Granular Imports (Production)

```typescript
import { reactive, fromEvent } from 'rxdb2/reactive'
import { map, filter, scan } from 'rxdb2/operators'
import { defineCollection } from 'rxdb2/collections'
import { createIndexedDBAdapter } from 'rxdb2/storage'
import { z } from 'rxdb2/validation'
```

**Pros:**
- Optimal tree-shaking
- Smaller bundle sizes
- Only includes needed functionality
- Better performance

**Cons:**
- More import statements
- Requires knowledge of chunk structure

### 3. Mixed Strategy

```typescript
// Import commonly used chunks together
import { reactive, map, filter } from 'rxdb2/reactive'
import { map, filter, scan } from 'rxdb2/operators'

// Import specialized chunks separately
import { createIndexedDBAdapter } from 'rxdb2/storage'
import { z } from 'rxdb2/validation'
```

## 🚀 Performance Benefits

### Bundle Size Comparison

```typescript
// Full import
import { reactive, map, defineCollection } from 'rxdb2'
// Bundle size: ~45KB (all chunks)

// Granular imports
import { reactive } from 'rxdb2/reactive'
import { map } from 'rxdb2/operators'
import { defineCollection } from 'rxdb2/collections'
// Bundle size: ~15KB (only needed chunks)
```

### Tree-Shaking Analysis

```bash
# Bundle analysis shows only imported chunks
bundle-analyzer dist/
# Shows: reactive/, operators/, collections/ (if imported)
# NOT: storage/, validation/, plugins/ (if not imported)
```

## 🧪 Testing Strategy

### Individual Chunk Testing

```typescript
// Test reactive chunk in isolation
import { reactive, fromEvent } from 'rxdb2/reactive'

test('reactive chunk', () => {
  const count = reactive(0)
  expect(count.get()).toBe(0)
})
```

### Integration Testing

```typescript
// Test chunk integration
import { reactive } from 'rxdb2/reactive'
import { map } from 'rxdb2/operators'
import { defineCollection } from 'rxdb2/collections'

test('chunk integration', () => {
  const count = reactive(0)
  const doubled = map(count, x => x * 2)
  const users = defineCollection('users', UserSchema)
  // Test integration
})
```

## 🔧 Maintenance Benefits

### 1. **Clear Separation of Concerns**

Each chunk has a specific responsibility:
- `reactive.ts`: Reactive primitives and creation
- `coreOperators.ts`: Data transformation and combination
- `collections.ts`: Data management and persistence
- `storage.ts`: Storage abstraction
- `validation.ts`: Schema validation
- `plugins.ts`: Extensibility

### 2. **Easier Refactoring**

```typescript
// Before: All exports in one file
// src/index.ts (200+ lines)

// After: Organized into chunks
// src/chunks/reactive.ts (20 lines)
// src/chunks/operators.ts (15 lines)
// src/chunks/collections.ts (25 lines)
// etc.
```

### 3. **Better Code Reviews**

```typescript
// Reviewers can focus on specific chunks
// PR: "Update reactive operators"
// Files: src/chunks/coreOperators.ts
// Scope: Limited and focused
```

## 📋 Best Practices

### For Library Consumers

1. **Production Apps**: Use granular imports
2. **Development**: Use full import for convenience
3. **Libraries**: Always use granular imports
4. **Bundle Analysis**: Monitor chunk usage

### For Library Maintainers

1. **Chunk Organization**: Keep related functionality together
2. **Dependencies**: Minimize cross-chunk dependencies
3. **Testing**: Test chunks individually and together
4. **Documentation**: Document each chunk's purpose

### For Performance Optimization

1. **Bundle Analysis**: Use tools like `webpack-bundle-analyzer`
2. **Chunk Splitting**: Consider further splitting large chunks
3. **Lazy Loading**: Load chunks on demand when possible
4. **Caching**: Leverage chunk-based caching strategies

## 🎉 Summary

The chunked architecture provides:

- ✅ **Optimal tree-shaking**: Only needed code included
- ✅ **Better maintainability**: Clear separation of concerns
- ✅ **Flexible imports**: Granular or full imports
- ✅ **Improved testing**: Isolated chunk testing
- ✅ **Performance benefits**: Smaller bundle sizes
- ✅ **Developer experience**: Intuitive API organization

This architecture ensures rxDB2 provides both convenience for development and performance for production while maintaining clean, maintainable code. 