# Tree-Shaking Best Practices

This document outlines rxDB2's tree-shaking strategy and best practices for ensuring optimal bundle sizes and performance.

## 🎯 Core Principles

### 1. **Named Exports Only**
We use named exports exclusively to enable optimal tree-shaking:

```typescript
// ✅ GOOD: Named exports enable tree-shaking
export function reactive<T>(initial: T): Reactive<T> { ... }
export const createIndexedDBAdapter = (options) => { ... }
export class StorageError extends Error { ... }

// ❌ BAD: Default exports inhibit tree-shaking
export default function reactive() { ... }
export default class StorageError { ... }
```

### 2. **Self-Contained Operators**
Each operator is self-contained and doesn't depend on other operators:

```typescript
// ✅ GOOD: Self-contained operator
export function map<T, U>(source: any, project: (value: T) => U): any {
  const result = reactive(project(source.get()))
  source.subscribe(value => result.set(project(value)))
  return result
}

// ❌ BAD: Operator with dependencies (would prevent tree-shaking)
import { otherOperator } from './otherOperator'
export function map<T, U>(source: any, project: (value: T) => U): any {
  return otherOperator(source, project) // Dependency prevents tree-shaking
}
```

### 3. **Chunked Architecture**
Organize exports into logical chunks for granular tree-shaking:

```typescript
// src/chunks/coreOperators.ts
export { 
  takeWhile, sample, switchMap, mergeMap, zip, 
  withLatestFrom, combineLatest, delay, pairwise,
  retry, catchError, startWith, scan, tap, concatMap
} from '../../packages/engine/src/operators.js'
```

## 📦 Export Strategy

### Function Exports
```typescript
// ✅ GOOD: Named function exports
export function reactive<T>(initial: T): Reactive<T> {
  // Implementation
}

export function createIndexedDBAdapter(options?: IndexedDBOptions): IndexedDBAdapter {
  return new IndexedDBAdapter(options)
}
```

### Class Exports
```typescript
// ✅ GOOD: Named class exports
export class StorageError extends Error {
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'StorageError'
  }
}

export class IndexedDBAdapter implements StorageAdapter {
  // Implementation
}
```

### Type Exports
```typescript
// ✅ GOOD: Named type exports
export type Reactive<T> = {
  get(): T
  set(value: T): void
  subscribe(callback: (value: T) => void): () => void
}

export type Collection<T> = {
  insert(item: T): void
  tryInsert(item: T): InsertResult<T>
  // ... other methods
}
```

### Const Exports
```typescript
// ✅ GOOD: Named const exports
export const createAsyncStorageAdapter = (options?: AsyncStorageOptions): AsyncStorageAdapter => {
  return new AsyncStorageAdapter(options)
}
```

## 🚫 What We Avoid

### Default Exports
```typescript
// ❌ BAD: Default exports inhibit tree-shaking
export default function reactive() { ... }
export default class StorageError { ... }
export default { reactive, map, filter }
```

### Namespace Exports
```typescript
// ❌ BAD: Namespace exports make tree-shaking difficult
export * as operators from './operators'
export * as reactive from './reactive'
```

### Mixed Export Styles
```typescript
// ❌ BAD: Inconsistent export styles
export function reactive() { ... }
export default class StorageError { ... }
export const map = ...
```

## 🔧 Implementation Examples

### Operator Implementation
```typescript
// packages/engine/src/operators.ts
export function map<T, U>(source: any, project: (value: T) => U): any {
  const result = reactive(project(source.get()))
  
  source.subscribe(value => {
    result.set(project(value))
  })
  
  return result
}

export function filter<T>(source: any, predicate: (value: T) => boolean): any {
  const result = reactive(source.get())
  
  source.subscribe(value => {
    if (predicate(value)) {
      result.set(value)
    }
  })
  
  return result
}

// Each operator is self-contained and can be tree-shaken independently
```

### Storage Adapter Implementation
```typescript
// src/storage/indexeddb.ts
export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null
  private connected = false
  
  constructor(options: IndexedDBOptions = {}) {
    // Implementation
  }
  
  async connect(): Promise<void> {
    // Implementation
  }
  
  // ... other methods
}

export function createIndexedDBAdapter(options?: IndexedDBOptions): IndexedDBAdapter {
  return new IndexedDBAdapter(options)
}
```

### Collection Implementation
```typescript
// packages/engine/src/database/defineCollection.ts
export function defineCollection<T extends { id: any }>(
  name: string, 
  schema: ZodSchema<T>
): Collection<T> {
  // Implementation
  return {
    insert: (item: T) => { /* implementation */ },
    tryInsert: (item: T): InsertResult<T> => { /* implementation */ },
    // ... other methods
  }
}

export type Collection<T> = {
  insert(item: T): void
  tryInsert(item: T): InsertResult<T>
  update(id: T['id'], updates: Partial<T>): UpdateResult<T>
  // ... other types
}
```

## 📊 Tree-Shaking Verification

### Bundle Analysis
```bash
# Analyze bundle to verify tree-shaking
npm run build
npx webpack-bundle-analyzer dist/

# Expected output: Only imported functions/classes included
```

### Import Testing
```typescript
// Test 1: Import only reactive
import { reactive } from 'rxdb2/reactive'
// Bundle should include: reactive function only

// Test 2: Import only operators
import { map, filter } from 'rxdb2/operators'
// Bundle should include: map, filter functions only

// Test 3: Import only collections
import { defineCollection } from 'rxdb2/collections'
// Bundle should include: defineCollection function only

// Test 4: Full import
import { reactive, map, defineCollection } from 'rxdb2'
// Bundle should include: all imported functions
```

### Size Comparison
```typescript
// Granular imports (optimal tree-shaking)
import { reactive } from 'rxdb2/reactive'           // ~2KB
import { map, filter } from 'rxdb2/operators'       // ~5KB
import { defineCollection } from 'rxdb2/collections' // ~3KB
// Total: ~10KB

// Full import (convenient but larger)
import { reactive, map, filter, defineCollection } from 'rxdb2'
// Total: ~25KB (includes all chunks)
```

## 🎯 Best Practices for Consumers

### 1. **Use Granular Imports for Production**
```typescript
// ✅ GOOD: Production-ready imports
import { reactive } from 'rxdb2/reactive'
import { map, filter, scan } from 'rxdb2/operators'
import { defineCollection } from 'rxdb2/collections'
import { createIndexedDBAdapter } from 'rxdb2/storage'
import { z } from 'rxdb2/validation'
```

### 2. **Avoid Namespace Imports**
```typescript
// ❌ BAD: Namespace imports prevent tree-shaking
import * as rxdb2 from 'rxdb2'

// ✅ GOOD: Named imports enable tree-shaking
import { reactive, map, defineCollection } from 'rxdb2'
```

### 3. **Use Type-Only Imports for Types**
```typescript
// ✅ GOOD: Type-only imports are eliminated at runtime
import type { Collection, InsertResult } from 'rxdb2/collections'
import { defineCollection } from 'rxdb2/collections'

const users: Collection<User> = defineCollection('users', UserSchema)
```

### 4. **Monitor Bundle Sizes**
```bash
# Regular bundle analysis
npm run build:analyze

# Compare before/after changes
npm run build:size
```

## 🔍 Verification Tools

### Webpack Bundle Analyzer
```bash
npm install --save-dev webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/
```

### Rollup Bundle Analyzer
```bash
npm install --save-dev rollup-plugin-visualizer
# Configure in rollup.config.js
```

### Size Limit
```bash
npm install --save-dev size-limit
# Configure in package.json
```

## 📋 Checklist

### For Library Maintainers
- [ ] All exports use named exports (no default exports)
- [ ] Operators are self-contained (no cross-dependencies)
- [ ] Functions use `export function` syntax
- [ ] Classes use `export class` syntax
- [ ] Types use `export type` syntax
- [ ] Constants use `export const` syntax
- [ ] Chunks are logically organized
- [ ] Bundle analysis shows expected tree-shaking

### For Library Consumers
- [ ] Use granular imports for production
- [ ] Avoid namespace imports (`import * as`)
- [ ] Use type-only imports for types
- [ ] Monitor bundle sizes regularly
- [ ] Test tree-shaking with bundle analyzer

## 🎉 Benefits Achieved

### Performance
- **Smaller bundle sizes**: Only needed code included
- **Faster load times**: Reduced JavaScript payload
- **Better caching**: Granular chunk caching
- **Improved performance**: Less parsing and execution

### Developer Experience
- **Intuitive imports**: Clear, explicit imports
- **Better IDE support**: Named exports provide better autocomplete
- **Easier debugging**: Clear import paths
- **Type safety**: Full TypeScript support

### Maintainability
- **Clear dependencies**: Explicit import statements
- **Easier refactoring**: Named exports are easier to rename
- **Better testing**: Isolated function testing
- **Reduced coupling**: Self-contained modules

This tree-shaking strategy ensures rxDB2 provides optimal performance while maintaining excellent developer experience and code maintainability. 