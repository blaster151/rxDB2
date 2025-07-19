# API Encapsulation & Public Surface

This document explains how rxDB2 properly encapsulates its public API and why internal module paths should never be exposed to consumers.

## 🎯 The Problem

### Before: Leaking Internal Paths

```typescript
// ❌ BAD: Exposing internal module paths
export { reactive } from '../packages/engine/src/reactive.js'
export { defineCollection } from '../packages/engine/src/database/defineCollection.js'
export { createIndexedDBAdapter } from './storage/indexeddb.js'
```

**Issues:**
- Consumers depend on internal file structure
- Internal refactoring breaks consumer code
- No clear public/private boundary
- Tree-shaking becomes unreliable
- Bundle analysis shows internal paths

### After: Proper Encapsulation

```typescript
// ✅ GOOD: Clean public API surface
export * from './reactive/index.js'
export * from './collections/index.js'
export * from './storage/index.js'
export * from './validation/index.js'
```

**Benefits:**
- Consumers only see public APIs
- Internal structure can change freely
- Clear public/private boundary
- Reliable tree-shaking
- Clean bundle analysis

## 📁 Proper Module Structure

### Public Modules

```
src/
├── index.ts              # Main public API (re-exports only)
├── reactive/
│   └── index.ts          # Public reactive API
├── collections/
│   └── index.ts          # Public collections API
├── storage/
│   └── index.ts          # Public storage API
├── validation/
│   └── index.ts          # Public validation API
└── types.ts              # Public type definitions
```

### Internal Modules

```
src/
├── internal/             # NOT EXPORTED
│   ├── state/
│   ├── debug/
│   ├── cache/
│   └── utils/
├── core/                 # Legacy, minimal exports
└── packages/             # Engine implementation
```

## 🔒 Encapsulation Rules

### ✅ What to Export

1. **Public modules only**: `./reactive/`, `./collections/`, `./storage/`, `./validation/`
2. **Stable APIs**: Functions and types that follow semantic versioning
3. **Well-documented**: APIs with clear documentation and examples
4. **Type-safe**: Full TypeScript support with runtime validation

### ❌ What NOT to Export

1. **Internal paths**: `../packages/engine/src/...`
2. **Implementation details**: Internal state, debug utilities, experimental features
3. **Unstable APIs**: APIs that may change without notice
4. **Direct file access**: `./storage/indexeddb.js` (use `./storage/` instead)

## 📦 Package.json Exports

### Proper Subpath Exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./reactive": {
      "types": "./dist/reactive/index.d.ts",
      "import": "./dist/reactive/index.js"
    },
    "./collections": {
      "types": "./dist/collections/index.d.ts",
      "import": "./dist/collections/index.js"
    },
    "./storage": {
      "types": "./dist/storage/index.d.ts",
      "import": "./dist/storage/index.js"
    },
    "./validation": {
      "types": "./dist/validation/index.d.ts",
      "import": "./dist/validation/index.js"
    }
  }
}
```

### Consumer Usage

```typescript
// ✅ GOOD: Using public subpath exports
import { reactive, fromEvent } from 'rxdb2/reactive'
import { defineCollection } from 'rxdb2/collections'
import { createIndexedDBAdapter } from 'rxdb2/storage'
import { z } from 'rxdb2/validation'

// ❌ BAD: Trying to access internal paths (won't work)
import { reactive } from 'rxdb2/packages/engine/src/reactive'
import { defineCollection } from 'rxdb2/src/database/defineCollection'
```

## 🎯 Benefits of Proper Encapsulation

### 1. **API Stability**

```typescript
// Internal structure can change without breaking consumers
// Before: src/packages/engine/src/reactive.js
// After:  src/internal/reactive/core.js

// Consumer code remains unchanged
import { reactive } from 'rxdb2/reactive' // ✅ Still works
```

### 2. **Tree-Shaking**

```typescript
// Only public APIs are included in bundles
import { reactive } from 'rxdb2/reactive' // ✅ Only reactive included
import { defineCollection } from 'rxdb2/collections' // ✅ Only collections included

// Internal implementation details are tree-shaken out
```

### 3. **Bundle Analysis**

```bash
# Clean bundle analysis shows only public modules
bundle-analyzer dist/
# Shows: reactive/, collections/, storage/, validation/
# NOT: packages/, internal/, core/
```

### 4. **Type Safety**

```typescript
// Public types are stable and well-defined
import type { Collection, InsertResult } from 'rxdb2/collections'

// Internal types are not exposed
// ❌ Won't work: import type { InternalState } from 'rxdb2/internal'
```

## 🔧 Implementation Details

### Public Module Example

```typescript
// src/reactive/index.ts
export { reactive } from '../../packages/engine/src/reactive.js'
export type { Reactive } from '../../packages/engine/src/reactive.js'
export { fromEvent } from '../../packages/engine/src/fromEvent.js'
// ... other reactive exports
```

### Main Index

```typescript
// src/index.ts
export * from './reactive/index.js'
export * from './collections/index.js'
export * from './storage/index.js'
export * from './validation/index.js'
export type { Plugin, PluginContext } from './types.js'
```

## 🧪 Testing Strategy

### Public API Tests

```typescript
// Test only public APIs
import { reactive, defineCollection } from 'rxdb2'

test('public API works', () => {
  const count = reactive(0)
  const users = defineCollection('users', UserSchema)
  // Test public functionality
})
```

### Internal API Tests

```typescript
// Test internal APIs separately
import { internalStateManager } from '../src/internal/state'

test('internal implementation', () => {
  // Test internal functionality
})
```

## 📋 Migration Checklist

When updating the public API:

1. **✅ Create public module**: `src/new-feature/index.ts`
2. **✅ Export from public module**: Re-export internal functionality
3. **✅ Update main index**: Add to `src/index.ts`
4. **✅ Update package.json**: Add subpath export
5. **✅ Update documentation**: Document new public API
6. **✅ Update tests**: Test public API only
7. **✅ Verify encapsulation**: No internal paths exposed

## 🚨 Common Mistakes

### ❌ Don't Do This

```typescript
// src/index.ts
export { reactive } from '../packages/engine/src/reactive.js' // ❌ Internal path
export { defineCollection } from './core/collection.js' // ❌ Implementation detail
export * from './storage/indexeddb.js' // ❌ Direct file export
```

### ✅ Do This Instead

```typescript
// src/index.ts
export * from './reactive/index.js' // ✅ Public module
export * from './collections/index.js' // ✅ Public module
export * from './storage/index.js' // ✅ Public module
```

## 🎉 Summary

Proper API encapsulation ensures:

- ✅ **Stable APIs**: Internal changes don't break consumers
- ✅ **Clean bundles**: Only public code included
- ✅ **Type safety**: Well-defined public types
- ✅ **Maintainability**: Clear public/private boundaries
- ✅ **Developer experience**: Intuitive, discoverable APIs

By following these encapsulation rules, rxDB2 provides a clean, stable public API that consumers can rely on while maintaining the flexibility to evolve internal implementation details. 