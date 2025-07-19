# Share Operator

The `share` operator implements multicast semantics with reference counting, allowing multiple subscribers to share a single subscription to the source stream.

## Overview

The `share` operator is a higher-level convenience operator that transforms a unicast (single-subscriber) stream into a multicast (multi-subscriber) stream with automatic connection management. It internally uses the `multicast` operator and automatically connects on first subscription and disconnects on last unsubscription.

## Behavior

- **Multicast**: Multiple subscribers share a single subscription to the source
- **Automatic Connection**: Automatically connects to source on first subscription
- **Reference Counting**: Source subscription is maintained until the last subscriber unsubscribes
- **Automatic Disconnection**: Source subscription is automatically cleaned up when refCount reaches zero
- **Reconnection**: New subscribers after cleanup create a fresh connection to the source
- **Built on Multicast**: Internally uses the `multicast` operator for the underlying implementation

## API

```typescript
function share<T>(source: Reactive<T>): Reactive<T>
```

### Parameters

- `source`: The source reactive stream to share

### Returns

- A new reactive stream that can be subscribed to multiple times

## Usage

### Basic Sharing

```typescript
import { share } from '@rxdb2/engine'

const source = reactive(0)
const shared = share(source)

// Multiple subscribers share the same source subscription
const unsub1 = shared.subscribe(val => console.log('Subscriber 1:', val))
const unsub2 = shared.subscribe(val => console.log('Subscriber 2:', val))
const unsub3 = shared.subscribe(val => console.log('Subscriber 3:', val))

source.set(1) // All three subscribers receive the value
source.set(2) // All three subscribers receive the value

unsub1()
unsub2()
unsub3() // Source subscription is cleaned up after last unsubscribe
```

### Reference Counting

```typescript
const source = reactive(0)
const shared = share(source)

const sub1 = shared.subscribe(() => {})
const sub2 = shared.subscribe(() => {})
const sub3 = shared.subscribe(() => {})

// Source has 1 subscription (shared among all subscribers)

sub1() // Still 1 subscription
sub2() // Still 1 subscription  
sub3() // Now 0 subscriptions (source is unsubscribed)
```

### Integration with Operators

```typescript
const source = reactive(0)
const shared = share(source)
const transformed = shared
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

### API Call Sharing

```typescript
// Expensive API call that should be shared
const apiCall = reactive({ data: null, loading: false })
const sharedApiCall = share(apiCall)

// Multiple components can subscribe to the same API call
const component1 = sharedApiCall.subscribe(data => {
  console.log('Component 1 received:', data)
})

const component2 = sharedApiCall.subscribe(data => {
  console.log('Component 2 received:', data)
})

// Only one API call is made, both components receive the result
```

### Event Stream Sharing

```typescript
// Mouse move events that should be shared
const mouseMoves = fromEvent(document, 'mousemove')
const sharedMouseMoves = share(mouseMoves)

// Multiple components can listen to mouse moves
const tooltip = sharedMouseMoves.subscribe(event => {
  // Update tooltip position
})

const analytics = sharedMouseMoves.subscribe(event => {
  // Track mouse movement for analytics
})

// Only one event listener is attached to the document
```

### WebSocket Connection Sharing

```typescript
// WebSocket connection that should be shared
const wsConnection = fromWebSocket('ws://example.com')
const sharedConnection = share(wsConnection)

// Multiple parts of the app can use the same connection
const chatComponent = sharedConnection.subscribe(message => {
  // Handle chat messages
})

const notificationComponent = sharedConnection.subscribe(message => {
  // Handle notifications
})

// Only one WebSocket connection is maintained
```

## Edge Cases and Considerations

### Unsubscribe During Emission

```typescript
const source = reactive(0)
const shared = share(source)

let unsub: (() => void) | null = null
const results: number[] = []

unsub = shared.subscribe(val => {
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
const shared = share(source)

const unsub = shared.subscribe(() => {})

unsub()
unsub() // Safe to call multiple times
unsub() // Safe to call multiple times
```

### Observers That Throw

```typescript
const source = reactive(0)
const shared = share(source)

const results: number[] = []

shared.subscribe(val => {
  if (val === 1) {
    throw new Error('Observer error')
  }
  results.push(val)
})

shared.subscribe(val => results.push(val))

source.set(1) // First observer throws
source.set(2) // Second observer still receives

console.log(results) // [2]
```

### Memory Management

```typescript
const source = reactive(0)
const shared = share(source)

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

const sharedTracked = share(trackedSource)

const sub1 = sharedTracked.subscribe(() => {})
const sub2 = sharedTracked.subscribe(() => {})

console.log(subscriptionCount) // 1

sub1()
console.log(subscriptionCount) // 1

sub2()
console.log(subscriptionCount) // 0
```

## Testing Strategy

### Basic Functionality

```typescript
describe('share', () => {
  it('should share a single subscription among multiple observers', () => {
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

    const shared = share(trackedSource)
    
    const unsub1 = shared.subscribe(() => {})
    const unsub2 = shared.subscribe(() => {})
    const unsub3 = shared.subscribe(() => {})

    expect(subscriptionCount).toBe(1) // Only one subscription

    unsub1()
    unsub2()
    unsub3()

    expect(subscriptionCount).toBe(0) // All cleaned up
  })
})
```

### Reference Counting

```typescript
it('should maintain source subscription until last observer unsubscribes', () => {
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

  const shared = share(trackedSource)
  
  const unsub1 = shared.subscribe(() => {})
  const unsub2 = shared.subscribe(() => {})
  const unsub3 = shared.subscribe(() => {})

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
  const shared = share(source)
  
  const results1: number[] = []
  const results2: number[] = []
  const results3: number[] = []

  const unsub1 = shared.subscribe(val => results1.push(val))
  
  source.set(1)
  
  const unsub2 = shared.subscribe(val => results2.push(val))
  
  source.set(2)
  
  const unsub3 = shared.subscribe(val => results3.push(val))
  
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

- **Observer Set**: Maintains a Set of all active observers
- **Reference Counting**: Minimal overhead for tracking subscription count
- **Automatic Cleanup**: Observers are removed from Set on unsubscribe

### Subscription Management

- **Lazy Connection**: Source subscription only created when first subscriber subscribes
- **Efficient Multicast**: Single source subscription shared among all observers
- **Proper Cleanup**: Source subscription automatically cleaned up when refCount reaches zero

### Best Practices

```typescript
// ✅ Good: Share expensive operations
const expensiveApiCall = share(fromPromise(fetch('/api/data')))
const component1 = expensiveApiCall.subscribe(data => {})
const component2 = expensiveApiCall.subscribe(data => {})

// ✅ Good: Share event streams
const mouseMoves = share(fromEvent(document, 'mousemove'))
const tooltip = mouseMoves.subscribe(event => {})
const analytics = mouseMoves.subscribe(event => {})

// ❌ Bad: Don't share simple reactive values
const simpleValue = reactive(0)
const sharedSimple = share(simpleValue) // Unnecessary overhead

// ✅ Good: Use share for complex streams
const complexStream = source
  .map(x => expensiveTransform(x))
  .filter(x => complexCondition(x))
const sharedComplex = share(complexStream)
```

## Integration with Other Operators

The `share` operator works seamlessly with all other operators in the reactive system:

```typescript
const source = reactive(0)
const shared = share(source)

// Works with transformation operators
const mapped = shared.map(x => x * 2)
const filtered = shared.filter(x => x > 0)

// Works with combination operators
const combined = combineLatest(shared, otherSource)

// Works with error handling operators
const resilient = retry(shared, 3)
const withFallback = catchError(resilient, error => fallbackSource)

// Works with timing operators
const delayed = delay(shared, 100)
const sampled = sample(shared, notifier)
```

## Comparison with Other Patterns

### vs. Direct Subscription

```typescript
// ❌ Bad: Multiple direct subscriptions
const source = reactive(0)
const sub1 = source.subscribe(() => {}) // Creates subscription 1
const sub2 = source.subscribe(() => {}) // Creates subscription 2
const sub3 = source.subscribe(() => {}) // Creates subscription 3

// ✅ Good: Shared subscription
const source = reactive(0)
const shared = share(source)
const sub1 = shared.subscribe(() => {}) // Creates shared subscription
const sub2 = shared.subscribe(() => {}) // Uses existing subscription
const sub3 = shared.subscribe(() => {}) // Uses existing subscription
```

### vs. Manual Multicast

```typescript
// ❌ Bad: Manual multicast implementation
const source = reactive(0)
const observers: Set<(value: number) => void> = new Set()
const sub = source.subscribe(value => {
  for (const observer of observers) {
    observer(value)
  }
})

// ✅ Good: Use share operator
const source = reactive(0)
const shared = share(source)
```

The `share` operator provides a clean, efficient, and well-tested implementation of multicast semantics with proper resource management. 