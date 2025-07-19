# fromPromise / fromAsync Functions

The `fromPromise` and `fromAsync` functions create Reactive<T> streams from Promises and async functions, emitting a single value then completing.

## Features

- ✅ **Single Value Emission**: Emits resolved value once, then completes
- ✅ **Error Handling**: Supports rejection as error events
- ✅ **Teardown Support**: Cancels pending operations on unsubscribe
- ✅ **Async Timing**: Handles both immediate and delayed promises
- ✅ **Memory Management**: No memory leaks, proper cleanup
- ✅ **Multiple Subscribers**: Shared promise resolution

## Core Behavior

### Promise Resolution

- **Single Emission**: Emits the resolved value exactly once
- **Completion**: Stream completes after emitting the value
- **No Initial Value**: Does not emit initial value like regular reactive streams
- **Shared Resolution**: Multiple subscribers receive the same resolved value

### Error Handling

- **Rejection Logging**: Logs rejected promises to console (basic implementation)
- **Error Emission**: `fromPromiseWithError` emits errors as values
- **Cancellation**: Prevents error logging if unsubscribed before rejection

### Teardown Logic

- **Cancellation Flag**: Sets cancellation flag on unsubscribe
- **No Late Emissions**: Prevents emissions after unsubscribe
- **Memory Cleanup**: Clears references to prevent memory leaks

## Usage

### Basic Promise to Reactive

```typescript
import { fromPromise } from '@rxdb2/engine'

// Convert a Promise to a reactive stream
const promise = Promise.resolve('Hello, World!')
const stream = fromPromise(promise)

stream.subscribe(value => {
  console.log('Received:', value) // "Hello, World!"
})
```

### Async Function to Reactive

```typescript
import { fromAsync } from '@rxdb2/engine'

// Convert an async function to a reactive stream
const asyncFn = async () => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return 'Async result'
}

const stream = fromAsync(asyncFn)
stream.subscribe(value => {
  console.log('Async result:', value)
})
```

### Error Handling

```typescript
import { fromPromise, fromPromiseWithError } from '@rxdb2/engine'

// Basic error handling (logs to console)
const failingPromise = Promise.reject(new Error('Something went wrong'))
const stream = fromPromise(failingPromise)
stream.subscribe(value => {
  // This won't be called due to rejection
  console.log('Success:', value)
})

// Error emission
const errorStream = fromPromiseWithError(failingPromise)
errorStream.subscribe(value => {
  if (value instanceof Error) {
    console.log('Error caught:', value.message)
  } else {
    console.log('Success:', value)
  }
})
```

### API Calls

```typescript
import { fromAsync } from '@rxdb2/engine'

const fetchUser = async (id: number) => {
  const response = await fetch(`/api/users/${id}`)
  if (!response.ok) {
    throw new Error('User not found')
  }
  return response.json()
}

const userStream = fromAsync(() => fetchUser(1))
userStream.subscribe(user => {
  console.log('User data:', user)
})
```

## API Reference

### fromPromise<T>(promise: Promise<T>): Reactive<T>

Creates a Reactive<T> from a Promise.

#### Parameters

- `promise`: Promise<T> - The Promise to convert to a reactive stream

#### Returns

- `Reactive<T>` - A reactive stream that emits the resolved value once

### fromAsync<T>(asyncFn: () => Promise<T>): Reactive<T>

Creates a Reactive<T> from an async function.

#### Parameters

- `asyncFn`: () => Promise<T> - The async function to execute

#### Returns

- `Reactive<T>` - A reactive stream that emits the resolved value once

### fromPromiseWithError<T>(promise: Promise<T>): Reactive<T | Error>

Creates a Reactive<T | Error> that emits either the resolved value or an error.

#### Parameters

- `promise`: Promise<T> - The Promise to convert to a reactive stream

#### Returns

- `Reactive<T | Error>` - A reactive stream that emits the resolved value or an error

## Testing Strategy

### Async Timing Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { fromPromise } from '../fromPromise'

describe('fromPromise', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should handle delayed promises', () => {
    const promise = new Promise(resolve => {
      setTimeout(() => resolve('delayed'), 1000)
    })

    const stream = fromPromise(promise)
    const results: string[] = []

    stream.subscribe(value => {
      if (value) results.push(value)
    })

    expect(results).toEqual([])

    vi.advanceTimersByTime(1000)
    expect(results).toEqual(['delayed'])
  })
})
```

### Teardown Tests

```typescript
it('should not emit if unsubscribed before resolve', () => {
  let resolvePromise: (value: string) => void
  const promise = new Promise<string>(resolve => {
    resolvePromise = resolve
  })

  const stream = fromPromise(promise)
  const results: string[] = []

  const unsub = stream.subscribe(value => {
    if (value) results.push(value)
  })

  unsub() // Unsubscribe before resolve
  resolvePromise!('late value')

  expect(results).toEqual([]) // Should not emit
})
```

## Best Practices

### 1. Error Handling

```typescript
// ✅ Good: Use fromPromiseWithError for explicit error handling
const stream = fromPromiseWithError(fetch('/api/data'))
stream.subscribe(value => {
  if (value instanceof Error) {
    console.error('Request failed:', value.message)
  } else {
    console.log('Data received:', value)
  }
})

// ✅ Good: Handle errors in async functions
const safeAsyncFn = async () => {
  try {
    return await fetch('/api/data').then(r => r.json())
  } catch (error) {
    throw new Error(`API call failed: ${error.message}`)
  }
}
```

### 2. Memory Management

```typescript
// ✅ Good: Always unsubscribe
const stream = fromPromise(somePromise)
const unsub = stream.subscribe(value => {
  console.log('Value:', value)
})

// Later, when done
unsub()

// ❌ Bad: Memory leak
stream.subscribe(value => {
  console.log('Value:', value)
})
// Never unsubscribe
```

### 3. Multiple Subscribers

```typescript
// ✅ Good: Multiple subscribers share the same promise resolution
const promise = fetch('/api/data').then(r => r.json())
const stream = fromPromise(promise)

const unsub1 = stream.subscribe(data => console.log('Sub1:', data))
const unsub2 = stream.subscribe(data => console.log('Sub2:', data))

// Both receive the same data
unsub1()
unsub2()
```

### 4. Chaining with Operators

```typescript
// ✅ Good: Chain with reactive operators
const userStream = fromAsync(() => fetchUser(1))
  .map(user => user.name)
  .filter(name => name.length > 0)

userStream.subscribe(name => {
  console.log('User name:', name)
})
```

## Performance Considerations

- **Shared Resolution**: Multiple subscribers don't create multiple promise executions
- **Lazy Evaluation**: Promise execution starts immediately, not on subscription
- **Cancellation**: Unsubscribe prevents late emissions
- **Memory Efficiency**: Minimal overhead compared to manual promise handling

## Edge Cases

### Already Resolved Promises

```typescript
// Handles already resolved promises
const resolvedPromise = Promise.resolve('immediate')
const stream = fromPromise(resolvedPromise)

stream.subscribe(value => {
  console.log('Immediate:', value) // Emits immediately
})
```

### Already Rejected Promises

```typescript
// Handles already rejected promises
const rejectedPromise = Promise.reject(new Error('already failed'))
const stream = fromPromise(rejectedPromise)

stream.subscribe(value => {
  // Won't be called due to rejection
})
```

### Null/Undefined Values

```typescript
// Handles null/undefined values
const nullPromise = Promise.resolve(null)
const stream = fromPromise(nullPromise)

stream.subscribe(value => {
  console.log('Value:', value) // null
})
```

## Real-world Patterns

### Data Service Pattern

```typescript
class DataService {
  static async fetchData<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  }

  static createDataStream<T>(url: string) {
    return fromAsync(() => this.fetchData<T>(url))
  }
}

// Usage
const userStream = DataService.createDataStream<User>('/api/users/1')
userStream.subscribe(user => {
  console.log('User loaded:', user)
})
```

### Cached Promise Pattern

```typescript
const cache = new Map<string, Promise<any>>()

function getCachedData<T>(key: string, fetcher: () => Promise<T>): Reactive<T> {
  if (!cache.has(key)) {
    cache.set(key, fetcher())
  }
  return fromPromise(cache.get(key)!)
}

// Usage
const userStream = getCachedData('user-1', () => fetchUser(1))
``` 