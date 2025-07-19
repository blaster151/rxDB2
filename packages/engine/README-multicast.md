# Multicast Operator

The `multicast` operator implements multicast semantics by managing a set of subscribers and sharing a single subscription to the source stream.

## Overview

The `multicast` operator is a lower-level primitive that transforms a unicast (single-subscriber) stream into a multicast (multi-subscriber) stream with manual connection control. It maintains a set of subscribers and provides a `connect()` method to manually control when the source subscription is established.

## Behavior

- **Multicast**: Multiple subscribers share a single subscription to the source
- **Subscriber Management**: Maintains a Set of all active subscribers
- **Manual Connection**: Source subscription only created when `connect()` is called
- **Manual Control**: Provides `connect()` method for explicit connection management
- **Automatic Cleanup**: Source subscription automatically cleaned up when subscriber count reaches zero
- **Reconnection**: New subscribers after cleanup require manual `connect()` call

## API

```typescript
function multicast<T>(source: Reactive<T>): Reactive<T>
```

### Parameters

- `source`: The source reactive stream to multicast

### Returns

- A new reactive stream that can be subscribed to multiple times and provides a `connect()` method for manual connection control

## Usage

### Basic Multicast

```typescript
import { multicast } from '@rxdb2/engine'

const source = reactive(0)
const multicasted = multicast(source)

// Multiple subscribers share the same source subscription
const unsub1 = multicasted.subscribe(val => console.log('Subscriber 1:', val))
const unsub2 = multicasted.subscribe(val => console.log('Subscriber 2:', val))
const unsub3 = multicasted.subscribe(val => console.log('Subscriber 3:', val))

// Manual connection required
multicasted.connect()

source.set(1) // All three subscribers receive the value
source.set(2) // All three subscribers receive the value

unsub1()
unsub2()
unsub3() // Source subscription is cleaned up after last unsubscribe
```

### Manual Connection Control

```typescript
const source = reactive(0)
const multicasted = multicast(source)

const sub1 = multicasted.subscribe(() => {})
const sub2 = multicasted.subscribe(() => {})
const sub3 = multicasted.subscribe(() => {})

// No emissions until connect() is called
source.set(1) // No subscribers receive this

// Manual connection
multicasted.connect()

source.set(2) // All subscribers receive this

sub1() // Still connected
sub2() // Still connected
sub3() // Now disconnected (source is unsubscribed)
```

### Integration with Operators

```typescript
const source = reactive(0)
const multicasted = multicast(source)
const transformed = multicasted
  .map(x => x * 2)
  .filter(x => x > 0)
  .map(x => `Value: ${x}`)

// Multiple subscribers to the transformed stream
const unsub1 = transformed.subscribe(val => console.log('Transform 1:', val))
const unsub2 = transformed.subscribe(val => console.log('Transform 2:', val))

source.set(1) // Both subscribers receive "Value: 2"
source.set(2) // Both subscribers receive "Value: 4"
```

## Real-world Patterns

### Event Stream Sharing

```typescript
// Mouse move events that should be shared
const mouseMoves = fromEvent(document, 'mousemove')
const multicastedMouseMoves = multicast(mouseMoves)

// Multiple components can listen to mouse moves
const tooltip = multicastedMouseMoves.subscribe(event => {
  // Update tooltip position
})

const analytics = multicastedMouseMoves.subscribe(event => {
  // Track mouse movement for analytics
})

// Only one event listener is attached to the document
```

### WebSocket Connection Sharing

```typescript
// WebSocket connection that should be shared
const wsConnection = fromWebSocket('ws://example.com')
const multicastedConnection = multicast(wsConnection)

// Multiple parts of the app can use the same connection
const chatComponent = multicastedConnection.subscribe(message => {
  // Handle chat messages
})

const notificationComponent = multicastedConnection.subscribe(message => {
  // Handle notifications
})

// Only one WebSocket connection is maintained
```

### API Call Sharing

```typescript
// Expensive API call that should be shared
const apiCall = reactive({ data: null, loading: false })
const multicastedApiCall = multicast(apiCall)

// Multiple components can subscribe to the same API call
const component1 = multicastedApiCall.subscribe(data => {
  console.log('Component 1 received:', data)
})

const component2 = multicastedApiCall.subscribe(data => {
  console.log('Component 2 received:', data)
})

// Only one API call is made, both components receive the result
```

## Edge Cases and Considerations

### Unsubscribe During Emission

```typescript
const source = reactive(0)
const multicasted = multicast(source)

let unsub: (() => void) | null = null
const results: number[] = []

unsub = multicasted.subscribe(val => {
  results.push(val)
  if (val === 1 && unsub) {
    unsub() // Unsubscribe during emission
  }
})

source.set(1)
source.set(2) // Should not be received

console.log(results) // [1]
```

### Multiple Unsubscribes

```typescript
const source = reactive(0)
const multicasted = multicast(source)

const unsub = multicasted.subscribe(() => {})

unsub()
unsub() // Safe to call multiple times
unsub() // Safe to call multiple times
```

### Subscribers That Throw

```typescript
const source = reactive(0)
const multicasted = multicast(source)

const results: number[] = []

multicasted.subscribe(val => {
  if (val === 1) {
    throw new Error('Subscriber error')
  }
  results.push(val)
})

multicasted.subscribe(val => results.push(val))

source.set(1) // First subscriber throws
source.set(2) // Second subscriber should still receive

console.log(results) // [2]
```

### Memory Management

```typescript
const source = reactive(0)
const multicasted = multicast(source)

// Track subscriptions for testing
let subscriptionCount = 0
const trackedSource = {
  ...source,
  subscribe(callback: (value: number) => void) {
    subscriptionCount++
    const unsub = source.subscribe(callback)
    return () => {
      subscriptionCount--
      unsub()
    }
  }
}

const multicastedTracked = multicast(trackedSource)

const sub1 = multicastedTracked.subscribe(() => {})
const sub2 = multicastedTracked.subscribe(() => {})

console.log(subscriptionCount) // 1

sub1()
console.log(subscriptionCount) // 1

sub2()
console.log(subscriptionCount) // 0
```

## Testing Strategy

### Basic Functionality

```typescript
describe('multicast', () => {
  it('should multicast a single subscription among multiple subscribers', () => {
    let subscriptionCount = 0
    const source = reactive(0)
    
    const trackedSource = {
      ...source,
      subscribe(callback: (value: number) => void) {
        subscriptionCount++
        const unsub = source.subscribe(callback)
        return () => {
          subscriptionCount--
          unsub()
        }
      }
    }

    const multicasted = multicast(trackedSource)
    
    const unsub1 = multicasted.subscribe(() => {})
    const unsub2 = multicasted.subscribe(() => {})
    const unsub3 = multicasted.subscribe(() => {})

    expect(subscriptionCount).toBe(1) // Only one subscription

    unsub1()
    unsub2()
    unsub3()

    expect(subscriptionCount).toBe(0) // All cleaned up
  })
})
```

### Subscriber Management

```typescript
it('should maintain source subscription until last subscriber unsubscribes', () => {
  let subscriptionCount = 0
  const source = reactive(0)
  
  const trackedSource = {
    ...source,
    subscribe(callback: (value: number) => void) {
      subscriptionCount++
      const unsub = source.subscribe(callback)
      return () => {
        subscriptionCount--
        unsub()
      }
    }
  }

  const multicasted = multicast(trackedSource)
  
  const unsub1 = multicasted.subscribe(() => {})
  const unsub2 = multicasted.subscribe(() => {})
  const unsub3 = multicasted.subscribe(() => {})

  expect(subscriptionCount).toBe(1)

  unsub1() // Still subscribed
  expect(subscriptionCount).toBe(1)

  unsub2() // Still subscribed
  expect(subscriptionCount).toBe(1)

  unsub3() // Now unsubscribed
  expect(subscriptionCount).toBe(0)
})
```

### Multicast Semantics

```typescript
it('should multicast values to all active subscribers', () => {
  const source = reactive(0)
  const multicasted = multicast(source)
  
  const results1: number[] = []
  const results2: number[] = []
  const results3: number[] = []

  const unsub1 = multicasted.subscribe(val => results1.push(val))
  
  source.set(1)
  
  const unsub2 = multicasted.subscribe(val => results2.push(val))
  
  source.set(2)
  
  const unsub3 = multicasted.subscribe(val => results3.push(val))
  
  source.set(3)
  
  unsub1()
  source.set(4)
  
  unsub2()
  source.set(5)
  
  unsub3()
  
  expect(results1).toEqual([1, 2, 3]) // Got values while subscribed
  expect(results2).toEqual([2, 3, 4]) // Got values from subscription point
  expect(results3).toEqual([3, 5]) // Got values from subscription point
})
```

## Performance Considerations

### Memory Usage

- **Subscriber Set**: Maintains a Set of all active subscribers
- **Subscription Tracking**: Minimal overhead for tracking source subscription
- **Automatic Cleanup**: Subscribers are removed from Set on unsubscribe

### Subscription Management

- **Lazy Connection**: Source subscription only created when first subscriber subscribes
- **Efficient Multicast**: Single source subscription shared among all subscribers
- **Proper Cleanup**: Source subscription automatically cleaned up when subscriber count reaches zero

### Best Practices

```typescript
// ✅ Good: Multicast expensive operations
const expensiveApiCall = multicast(fromPromise(fetch('/api/data')))
const component1 = expensiveApiCall.subscribe(data => {})
const component2 = expensiveApiCall.subscribe(data => {})

// ✅ Good: Multicast event streams
const mouseMoves = multicast(fromEvent(document, 'mousemove'))
const tooltip = mouseMoves.subscribe(event => {})
const analytics = mouseMoves.subscribe(event => {})

// ❌ Bad: Don't multicast simple reactive values
const simpleValue = reactive(0)
const multicastedSimple = multicast(simpleValue) // Unnecessary overhead

// ✅ Good: Use multicast for complex streams
const complexStream = source
  .map(x => expensiveTransform(x))
  .filter(x => complexCondition(x))
const multicastedComplex = multicast(complexStream)
```

## Integration with Other Operators

The `multicast` operator works seamlessly with all other operators in the reactive system:

```typescript
const source = reactive(0)
const multicasted = multicast(source)

// Works with transformation operators
const mapped = multicasted.map(x => x * 2)
const filtered = multicasted.filter(x => x > 0)

// Works with combination operators
const combined = combineLatest(multicasted, otherSource)

// Works with error handling operators
const resilient = retry(multicasted, 3)
const withFallback = catchError(resilient, error => fallbackSource)

// Works with timing operators
const delayed = delay(multicasted, 100)
const sampled = sample(multicasted, notifier)
```

## Comparison with Share Operator

### Similarities

Both `multicast` and `share` operators provide multicast semantics:

- **Single Source Subscription**: Both maintain only one subscription to the source
- **Multiple Subscribers**: Both allow multiple subscribers to share the same stream
- **Automatic Cleanup**: Both clean up the source subscription when no subscribers remain
- **Reconnection**: Both create fresh subscriptions when resubscribing after cleanup

### Differences

**Implementation Approach:**
- **multicast**: Uses a Set to manage subscribers directly
- **share**: Uses reference counting with observers

**Internal Structure:**
- **multicast**: `subscribers: Set<Subscriber<T>>`
- **share**: `observers: Set<(value: T) => void>` with `refCount`

**Behavior:**
- **multicast**: More direct subscriber management
- **share**: More abstracted with reference counting

### Usage Comparison

```typescript
// Both achieve the same result
const source = reactive(0)

// Using multicast
const multicasted = multicast(source)
const sub1 = multicasted.subscribe(() => {})
const sub2 = multicasted.subscribe(() => {})

// Using share
const shared = share(source)
const sub3 = shared.subscribe(() => {})
const sub4 = shared.subscribe(() => {})

// Both maintain single source subscription
// Both clean up when all subscribers unsubscribe
```

## Comparison with Other Patterns

### vs. Direct Subscription

```typescript
// ❌ Bad: Multiple direct subscriptions
const source = reactive(0)
const sub1 = source.subscribe(() => {}) // Creates subscription 1
const sub2 = source.subscribe(() => {}) // Creates subscription 2
const sub3 = source.subscribe(() => {}) // Creates subscription 3

// ✅ Good: Multicast subscription
const source = reactive(0)
const multicasted = multicast(source)
const sub1 = multicasted.subscribe(() => {}) // Creates shared subscription
const sub2 = multicasted.subscribe(() => {}) // Uses existing subscription
const sub3 = multicasted.subscribe(() => {}) // Uses existing subscription
```

### vs. Manual Multicast

```typescript
// ❌ Bad: Manual multicast implementation
const source = reactive(0)
const subscribers: Set<(value: number) => void> = new Set()
const sub = source.subscribe(value => {
  for (const s of subscribers) {
    s(value)
  }
})

// ✅ Good: Use multicast operator
const source = reactive(0)
const multicasted = multicast(source)
```

The `multicast` operator provides a clean, efficient, and well-tested implementation of multicast semantics with direct subscriber management. 