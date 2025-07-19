# Core Operators

This document covers the core reactive operators including error handling, transformation, and combination operators with proper edge case handling.

## Error Handling Operators

### retry(n: number)

Retries the source stream up to `n` times when an error occurs.

#### Behavior

- **Retry Logic**: Resubscribes to source on error up to `n` times
- **Reset on Success**: Retry count resets after successful emission
- **Max Retries**: Stops retrying and logs error after `n` attempts
- **Teardown**: Properly unsubscribes from previous attempts

#### Usage

```typescript
import { retry } from '@rxdb2/engine'

const unreliableSource = reactive(0)
const retryStream = retry(unreliableSource, 3)

retryStream.subscribe(value => {
  console.log('Success after retries:', value)
})
```

#### Example: API Call with Retry

```typescript
const apiCall = reactive(0)
const apiWithRetry = retry(apiCall, 2)

apiWithRetry.subscribe(response => {
  console.log('API response:', response)
})
```

### catchError(fn: (error) => Reactive<T>)

Switches to a fallback stream when an error occurs.

#### Behavior

- **Error Switching**: Calls `fn(error)` and subscribes to returned stream
- **Error Swallowing**: Original error is handled, not re-emitted
- **Cleanup**: Properly manages both source and fallback subscriptions
- **Multiple Errors**: Can handle multiple errors by switching streams

#### Usage

```typescript
import { catchError } from '@rxdb2/engine'

const source = reactive(0)
const fallback = reactive('fallback')

const resilientStream = catchError(source, (error) => fallback)

resilientStream.subscribe(value => {
  console.log('Value or fallback:', value)
})
```

#### Example: API with Fallback

```typescript
const apiCall = reactive(0)
const cachedData = reactive({ message: 'Cached data' })

const apiWithFallback = catchError(apiCall, (error) => cachedData)

apiWithFallback.subscribe(data => {
  console.log('API or cached data:', data)
})
```

## Transformation Operators

### startWith(value: T)

Prepends a value to the beginning of the stream.

#### Behavior

- **Immediate Emission**: Emits `value` immediately on subscription
- **Synchronous**: Value is emitted synchronously
- **Multiple Subscribers**: Each subscriber receives the initial value
- **Type Safety**: Maintains proper typing with source stream

#### Usage

```typescript
import { startWith } from '@rxdb2/engine'

const source = reactive(0)
const streamWithInitial = startWith(source, 'initial')

streamWithInitial.subscribe(value => {
  console.log('Value:', value) // 'initial', 0, 1, 2...
})
```

#### Example: Loading State

```typescript
const dataStream = reactive(null)
const loadingStream = startWith(dataStream, { status: 'loading' })

loadingStream.subscribe(state => {
  console.log('State:', state) // { status: 'loading' }, actual data...
})
```

### scan(fn: (acc, val) => acc, seed)

Accumulates values using a reducer function.

#### Behavior

- **Accumulation**: Emits accumulated value after each source emission
- **Seed Value**: Starts with provided seed value
- **Type Transformation**: Can transform from one type to another
- **Synchronous**: Accumulation happens synchronously

#### Usage

```typescript
import { scan } from '@rxdb2/engine'

const source = reactive(0)
const sumStream = scan(source, (acc, val) => acc + val, 0)

sumStream.subscribe(sum => {
  console.log('Running sum:', sum) // 0, 1, 3, 6...
})
```

#### Example: Form Validation

```typescript
const inputStream = reactive('')
const validationStream = scan(inputStream, (acc, val) => {
  const errors = []
  if (val.length < 3) errors.push('Too short')
  if (!val.includes('@')) errors.push('Missing @')
  return { value: val, errors, isValid: errors.length === 0 }
}, { value: '', errors: [], isValid: false })

validationStream.subscribe(validation => {
  console.log('Validation state:', validation)
})
```

## Combination Operators (Edge Cases Fixed)

### combineLatest(a, b)

Combines the latest values from two streams.

#### Fixed Edge Cases

- **No Initial Emission**: Doesn't emit until both sources have emitted
- **All Sources Required**: Only emits when all sources have at least one value
- **Continuous Emission**: Emits on every change after all sources have emitted
- **Never Emitting Sources**: Handles sources that never emit gracefully

#### Usage

```typescript
import { combineLatest } from '@rxdb2/engine'

const sourceA = reactive(0)
const sourceB = reactive(0)
const combined = combineLatest(sourceA, sourceB)

combined.subscribe(([a, b]) => {
  console.log('Combined:', a, b)
})
```

#### Example: Form with Multiple Fields

```typescript
const username = reactive('')
const password = reactive('')
const formValid = combineLatest(username, password)

formValid.subscribe(([user, pass]) => {
  const isValid = user.length > 0 && pass.length > 0
  console.log('Form valid:', isValid)
})
```

### withLatestFrom(source, other)

Emits when source emits, combining with the latest value from other.

#### Fixed Edge Cases

- **Other Must Emit First**: Doesn't emit until other has emitted at least once
- **Source-Driven**: Only emits on source changes, not other changes
- **Latest Value**: Always uses the most recent value from other
- **No Stale Data**: Prevents emissions with undefined other values

#### Usage

```typescript
import { withLatestFrom } from '@rxdb2/engine'

const source = reactive(0)
const other = reactive(0)
const withLatest = withLatestFrom(source, other)

withLatest.subscribe(([sourceVal, otherVal]) => {
  console.log('Source with latest other:', sourceVal, otherVal)
})
```

#### Example: Search with Filters

```typescript
const searchQuery = reactive('')
const searchFilters = reactive({ category: 'all' })
const searchWithFilters = withLatestFrom(searchQuery, searchFilters)

searchWithFilters.subscribe(([query, filters]) => {
  console.log('Searching:', query, 'with filters:', filters)
})
```

### switchMap(fn: T => Reactive<U>)

Maps to inner streams and switches to new ones, canceling previous.

#### Fixed Edge Cases

- **Cancellation**: Properly cancels previous inner subscriptions
- **Outer Completion**: Handles outer completion before inner completion
- **Rapid Emissions**: Manages rapid outer emissions efficiently
- **Memory Management**: Prevents memory leaks from abandoned subscriptions

#### Usage

```typescript
import { switchMap } from '@rxdb2/engine'

const outer = reactive(0)
const switched = switchMap(outer, (value) => {
  return reactive(`Inner stream for ${value}`)
})

switched.subscribe(value => {
  console.log('Switched value:', value)
})
```

#### Example: Search with Debouncing

```typescript
const searchInput = reactive('')
const searchResults = switchMap(searchInput, (query) => {
  // Simulate API call
  return reactive([`Result for "${query}"`])
})

searchResults.subscribe(results => {
  console.log('Search results:', results)
})
```

## Real-world Patterns

### Pattern 1: Resilient API Calls

```typescript
const apiCall = reactive(0)
const fallbackData = reactive({ message: 'Cached data' })

// Combine retry and error handling
const resilientApi = retry(apiCall, 3)
const apiWithFallback = catchError(resilientApi, (error) => fallbackData)

apiWithFallback.subscribe(data => {
  console.log('API result:', data)
})
```

### Pattern 2: Form State Management

```typescript
const formInput = reactive('')
const formState = scan(formInput, (acc, val) => {
  const errors = []
  if (val.length < 3) errors.push('Too short')
  if (!val.includes('@')) errors.push('Missing @')
  return { value: val, errors, isValid: errors.length === 0 }
}, { value: '', errors: [], isValid: false })

formState.subscribe(state => {
  console.log('Form state:', state)
})
```

### Pattern 3: Search with Cancellation

```typescript
const searchInput = reactive('')
const searchResults = switchMap(searchInput, (query) => {
  // This inner stream will be canceled when searchInput changes
  return reactive([`Result for "${query}"`])
})

searchResults.subscribe(results => {
  console.log('Search results:', results)
})
```

## Testing Strategy

### Error Handling Tests

```typescript
describe('retry', () => {
  it('should retry on error up to maxRetries times', () => {
    // Test retry logic
  })

  it('should reset retry count on successful emission', () => {
    // Test retry count reset
  })
})

describe('catchError', () => {
  it('should switch to fallback stream on error', () => {
    // Test error switching
  })

  it('should properly cleanup subscriptions', () => {
    // Test cleanup
  })
})
```

### Edge Case Tests

```typescript
describe('combineLatest', () => {
  it('should not emit until both sources have emitted', () => {
    // Test initial emission behavior
  })

  it('should handle one source never emitting', () => {
    // Test never-emitting sources
  })
})

describe('switchMap', () => {
  it('should cancel previous inner subscription when outer emits', () => {
    // Test cancellation
  })

  it('should handle rapid outer emissions', () => {
    // Test rapid emissions
  })
})
```

## Performance Considerations

### Error Handling

- **Retry Overhead**: Each retry creates new subscription
- **Error Switching**: Minimal overhead for fallback switching
- **Memory Management**: Proper cleanup prevents leaks

### Transformation

- **startWith**: Minimal overhead, synchronous emission
- **scan**: Efficient accumulation, no memory buildup

### Combination

- **combineLatest**: Efficient with proper edge case handling
- **withLatestFrom**: Minimal overhead, source-driven emissions
- **switchMap**: Efficient cancellation, prevents subscription buildup

## Best Practices

### 1. Error Handling

```typescript
// ✅ Good: Combine retry with error handling
const resilientStream = retry(source, 3)
const withFallback = catchError(resilientStream, (error) => fallback)

// ❌ Bad: Infinite retry without fallback
const infiniteRetry = retry(source, Infinity)
```

### 2. Memory Management

```typescript
// ✅ Good: Always unsubscribe
const unsub = stream.subscribe(value => console.log(value))
// Later
unsub()

// ❌ Bad: Memory leak
stream.subscribe(value => console.log(value))
// Never unsubscribe
```

### 3. Type Safety

```typescript
// ✅ Good: Proper typing
const scanStream = scan(source, (acc: number, val: number) => acc + val, 0)

// ❌ Bad: Loose typing
const scanStream = scan(source, (acc, val) => acc + val, 0)
```

### 4. Edge Case Handling

```typescript
// ✅ Good: Handle never-emitting sources
const combined = combineLatest(sourceA, sourceB)
// Will not emit until both sources emit

// ✅ Good: Handle rapid emissions
const switched = switchMap(outer, project)
// Will cancel previous inner subscriptions
``` 