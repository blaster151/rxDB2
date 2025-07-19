# rxDB2 Public API Reference

This document defines the official, stable public API surface for rxDB2. All APIs listed here are guaranteed to follow semantic versioning and are safe for production use.

## 🎯 API Design Principles

- **Tree-shakable**: Only imported APIs are included in bundles
- **Type-safe**: Full TypeScript support with runtime validation
- **ESM-compatible**: Native ES modules with `.js` extensions
- **Side-effect free**: Safe for bundler optimization
- **Explicit exports**: No wildcard exports to prevent API leaks
- **Encapsulated**: No internal module paths exposed to consumers

## 📦 Core Exports

### Main Import

```typescript
import { defineCollection, reactive, z } from 'rxdb2'
```

### Subpath Imports

```typescript
// Reactive functionality only
import { reactive, fromEvent, map, filter } from 'rxdb2/reactive'

// Collections only
import { defineCollection, createDatabase } from 'rxdb2/collections'

// Storage only
import { createIndexedDBAdapter } from 'rxdb2/storage'

// Validation only
import { z } from 'rxdb2/validation'
```

## 🔄 Core Reactive Primitives

### `reactive<T>(initial: T): Reactive<T>`

Creates a reactive value that can be observed and updated.

```typescript
import { reactive } from 'rxdb2'

const count = reactive(0)
count.subscribe(value => console.log('Count:', value))
count.set(5) // Triggers subscription
```

### `createObservable<T>(initial: T): Observable<T>`

Creates an observable stream with subscription management.

```typescript
import { createObservable } from 'rxdb2'

const stream = createObservable(0)
const subscription = stream.subscribe(value => console.log(value))
subscription.unsubscribe()
```

## 🎬 Creation Utilities

### `fromEvent<T>(target: EventTarget, eventName: string): Reactive<T>`

Creates a reactive stream from DOM events.

```typescript
import { fromEvent } from 'rxdb2'

const clicks = fromEvent(document, 'click')
clicks.subscribe(event => console.log('Clicked:', event))
```

### `fromWebSocket(url: string, options?: WebSocketOptions): Reactive<MessageEvent>`

Creates a reactive stream from WebSocket messages.

```typescript
import { fromWebSocket } from 'rxdb2'

const messages = fromWebSocket('ws://localhost:8080')
messages.subscribe(event => console.log('Message:', event.data))
```

### `fromPromise<T>(promise: Promise<T>): Reactive<T>`

Creates a reactive stream from a Promise.

```typescript
import { fromPromise } from 'rxdb2'

const data = fromPromise(fetch('/api/data').then(r => r.json()))
data.subscribe(result => console.log('Data:', result))
```

## 🔧 Reactive Operators

### Core Operators

```typescript
import { map, filter, tap, scan, startWith } from 'rxdb2'

// Transform values
const doubled = map(count, x => x * 2)

// Filter values
const evenNumbers = filter(count, x => x % 2 === 0)

// Side effects
const logged = tap(count, x => console.log('Value:', x))

// Accumulate values
const sum = scan(count, (acc, val) => acc + val, 0)

// Start with initial value
const withInitial = startWith(count, 10)
```

### Error Handling

```typescript
import { catchError, retry } from 'rxdb2'

// Handle errors
const safe = catchError(stream, error => {
  console.error('Error:', error)
  return reactive(null)
})

// Retry failed operations
const resilient = retry(stream, 3)
```

### Transformation

```typescript
import { switchMap, mergeMap, concatMap } from 'rxdb2'

// Switch to new stream
const switched = switchMap(stream, value => 
  fromPromise(fetch(`/api/${value}`))
)

// Merge multiple streams
const merged = mergeMap(stream, value => 
  fromPromise(fetch(`/api/${value}`))
)

// Concatenate streams
const concatenated = concatMap(stream, value => 
  fromPromise(fetch(`/api/${value}`))
)
```

### Combination

```typescript
import { combineLatest, withLatestFrom, zip } from 'rxdb2'

// Combine latest values
const combined = combineLatest(stream1, stream2)

// With latest from another stream
const withLatest = withLatestFrom(stream1, stream2)

// Zip streams together
const zipped = zip(stream1, stream2)
```

### Sharing

```typescript
import { share, multicast } from 'rxdb2'

// Share subscription
const shared = share(stream)

// Multicast to multiple subscribers
const multicasted = multicast(stream)
```

### Utility Operators

```typescript
import { distinct, debounce, throttle, delay } from 'rxdb2'

// Only emit distinct values
const distinctValues = distinct(stream)

// Debounce emissions
const debounced = debounce(stream, 300)

// Throttle emissions
const throttled = throttle(stream, 300)

// Delay emissions
const delayed = delay(stream, 1000)
```

## 📚 Collection Management

### `defineCollection<T>(name: string, schema: ZodSchema<T>): Collection<T>`

Creates a type-safe, reactive collection with schema validation.

```typescript
import { defineCollection, z } from 'rxdb2'

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
})

const users = defineCollection<User>('users', UserSchema)
```

### Collection Methods

```typescript
// Safe insert with result object
const result = users.tryInsert({
  id: '1',
  name: 'Alice',
  email: 'alice@example.com'
})

if (result.success) {
  console.log('Inserted:', result.data)
} else {
  console.log('Error:', result.error)
}

// Safe update
const updateResult = users.tryUpdate('1', {
  name: 'Alice Smith'
})

// Safe delete
const deleteResult = users.tryDelete('1')

// Live queries
const liveUsers = users.liveQuery({ name: 'Alice' })
liveUsers.subscribe(users => console.log('Live users:', users))

// Static queries
const found = users.find({ name: 'Alice' })
```

## 💾 Storage Adapters

### `createIndexedDBAdapter(options?: IndexedDBOptions): StorageAdapter`

Creates an IndexedDB storage adapter with mock capabilities.

```typescript
import { createIndexedDBAdapter } from 'rxdb2'

const storage = createIndexedDBAdapter({
  dbName: 'myapp',
  version: 1,
  latency: 10, // Mock latency
  failureRate: 0.01 // 1% failure rate
})

await storage.connect()
await storage.set('key', { data: 'value' })
```

### `createAsyncStorageAdapter(options?: AsyncStorageOptions): StorageAdapter`

Creates an AsyncStorage adapter for React Native.

```typescript
import { createAsyncStorageAdapter } from 'rxdb2'

const storage = createAsyncStorageAdapter({
  prefix: 'myapp:',
  networkLatency: 50
})

await storage.set('key', { data: 'value' })
```

## 🎨 Schema & Validation

### Zod Integration

```typescript
import { z } from 'rxdb2'

// Define schemas
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0)
})

// Infer types
type User = z.infer<typeof UserSchema>

// Runtime validation
const user = UserSchema.parse({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Alice',
  email: 'alice@example.com',
  age: 25
})
```

## 🔌 Plugin System

### Plugin Interface

```typescript
import type { Plugin, PluginContext } from 'rxdb2'

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  install(context) {
    // Access rxDB2 APIs
    const { defineCollection, reactive, z } = context
    // Setup plugin functionality
  },
  uninstall() {
    // Cleanup
  }
}
```

### Plugin Usage

```typescript
// React hooks plugin
import { useCollection } from 'rxdb2/plugins/react-hooks'

// Vite devtools plugin
import { devtools } from 'rxdb2/plugins/vite-devtools'

// Zod integration plugin
import { zodPlugin } from 'rxdb2/plugins/zod-integration'
```

## 📋 Type Exports

### Core Types

```typescript
import type { 
  Reactive, 
  Collection, 
  InsertResult, 
  UpdateResult, 
  DeleteResult,
  StorageAdapter,
  Plugin,
  PluginContext
} from 'rxdb2'
```

### Type-Only Imports

```typescript
// Types are eliminated at runtime
import type { Collection, InsertResult } from 'rxdb2'

const users: Collection<User> = defineCollection('users', UserSchema)
```

## 🚀 Performance Features

### Tree-Shaking

```typescript
// Only these functions are included in the bundle
import { defineCollection, reactive } from 'rxdb2'

// Unused imports are eliminated
// import { fromEvent } from 'rxdb2' // Tree-shaken out
```

### Bundle Optimization

- **ESM**: Native ES modules for better compression
- **Side-effect free**: Safe for bundler optimization
- **Type elimination**: Type imports removed at runtime
- **Explicit exports**: No wildcard exports
- **Encapsulated**: No internal module paths exposed

## 🔒 API Stability

### Public APIs

- ✅ Follow semantic versioning
- ✅ Backward compatible within major versions
- ✅ Well-documented and tested
- ✅ Type-safe with full TypeScript support
- ✅ Encapsulated with no internal paths exposed

### Internal APIs

- ❌ Not part of public API
- ❌ Can change without notice
- ❌ Not documented for consumers
- ❌ Located in `src/internal/`
- ❌ Never exposed through public exports

## 🧪 Testing

### Public API Testing

```typescript
// Test only public APIs
import { defineCollection, reactive } from 'rxdb2'

test('should create collection', () => {
  const users = defineCollection('users', UserSchema)
  expect(users).toBeDefined()
})
```

### Internal API Testing

```typescript
// Test internal APIs separately
import { internalStateManager } from '../src/internal/state'

test('internal state management', () => {
  // Test internal implementation
})
```

## 📚 Migration Guide

### From Internal to Public

When promoting internal APIs:

1. **Move to public module**
2. **Add documentation**
3. **Update type exports**
4. **Add to public index.ts**
5. **Update tests**
6. **Remove from internal**

### Breaking Changes

Breaking changes follow semantic versioning:

- **Major**: Breaking changes (2.0.0)
- **Minor**: New features (1.1.0)
- **Patch**: Bug fixes (1.0.1)

## 🎉 Summary

rxDB2 provides a clean, stable public API that:

- ✅ **Tree-shakable**: Eliminates unused code
- ✅ **Type-safe**: Full TypeScript support
- ✅ **ESM-compatible**: Modern JavaScript modules
- ✅ **Well-documented**: Clear API reference
- ✅ **Stable**: Semantic versioning compliance
- ✅ **Performant**: Optimized for modern bundlers
- ✅ **Encapsulated**: No internal module paths exposed

This API surface ensures optimal developer experience and runtime performance while maintaining backward compatibility, type safety, and proper encapsulation. 