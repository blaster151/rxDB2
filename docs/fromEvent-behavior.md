# fromEvent() Shared Listener Behavior

## Overview

The `fromEvent()` function in rxDB2 implements **shared listener semantics** - a key difference from typical RxJS implementations that creates separate listeners per subscription.

## How It Works

### Traditional RxJS Behavior (Multiple Listeners)

```typescript
// Typical RxJS fromEvent - creates separate listeners
const clicks = fromEvent(button, 'click')

const sub1 = clicks.subscribe(console.log) // Adds listener #1
const sub2 = clicks.subscribe(console.log) // Adds listener #2

// Result: 2 listeners attached to the button
// Memory usage: Higher
// Performance: Slightly lower (2 event handlers)
```

### rxDB2 Behavior (Shared Listener)

```typescript
// rxDB2 fromEvent - shares one listener
const clicks = fromEvent(button, 'click')

const sub1 = clicks.subscribe(console.log) // Adds listener #1
const sub2 = clicks.subscribe(console.log) // Reuses listener #1

// Result: 1 listener attached to the button
// Memory usage: Lower
// Performance: Better (1 event handler)
```

## Implementation Details

### Reference Counting

The implementation uses a subscriber counter to manage the shared listener:

```typescript
let subscriberCount = 0
let eventListener: ((event: T) => void) | null = null

// Subscribe method
subscribe(callback: (value: T | null) => void) {
  const unsub = base.subscribe(callback)
  
  // Only add event listener once when first subscriber connects
  if (subscriberCount === 0) {
    eventListener = handleEvent
    target.addEventListener(eventName, eventListener as EventListener, options)
  }
  subscriberCount++
  
  return () => {
    unsub()
    subscriberCount--
    
    // Remove event listener when last subscriber disconnects
    if (subscriberCount === 0 && eventListener) {
      target.removeEventListener(eventName, eventListener as EventListener, options)
      eventListener = null
    }
  }
}
```

### Lifecycle Management

1. **First Subscription**: Event listener is added to the target
2. **Additional Subscriptions**: Reuse existing listener, increment counter
3. **Unsubscription**: Decrement counter, remove listener when counter reaches 0

## Benefits

### Memory Efficiency
- **Reduced Memory Usage**: One listener instead of multiple
- **No Memory Leaks**: Automatic cleanup when all subscribers disconnect
- **Lower Event Handler Overhead**: Fewer event handlers to manage

### Performance
- **Faster Event Handling**: Single listener processes all subscriptions
- **Reduced DOM Manipulation**: Fewer addEventListener/removeEventListener calls
- **Better Browser Optimization**: Browser can optimize single listener better

### Developer Experience
- **Predictable Behavior**: Clear lifecycle management
- **Automatic Cleanup**: No manual listener management required
- **Consistent with rxDB2 Philosophy**: Efficient, composable primitives

## Use Cases

### Multiple UI Components Listening to Same Event

```typescript
// Efficient: One listener for multiple components
const windowResize = fromEvent(window, 'resize')

// Component A
const unsubA = windowResize.subscribe(() => updateLayoutA())

// Component B  
const unsubB = windowResize.subscribe(() => updateLayoutB())

// Component C
const unsubC = windowResize.subscribe(() => updateLayoutC())

// All three components receive resize events
// Only ONE listener is attached to window
```

### Event-Driven Architecture

```typescript
// Shared event bus with efficient listener management
const userEvents = fromEvent(eventBus, 'userAction')

// Multiple services can subscribe without overhead
const analytics = userEvents.subscribe(trackUserAction)
const logging = userEvents.subscribe(logUserAction)
const ui = userEvents.subscribe(updateUI)

// All services receive events, minimal resource usage
```

## Comparison with Other Libraries

| Library | Listener Behavior | Memory Usage | Cleanup |
|---------|------------------|--------------|---------|
| **rxDB2** | Shared (1 per event) | Low | Automatic |
| **RxJS** | Separate (1 per subscription) | Higher | Manual |
| **Mosti** | Shared (with ref counting) | Low | Automatic |
| **XState** | Depends on implementation | Variable | Manual |

## Best Practices

### ✅ Do This

```typescript
// Create one fromEvent instance and reuse it
const clickEvents = fromEvent(button, 'click')

// Multiple subscriptions to the same stream
const sub1 = clickEvents.subscribe(handleClick)
const sub2 = clickEvents.subscribe(logClick)
const sub3 = clickEvents.subscribe(analytics)

// All share the same underlying listener
```

### ❌ Avoid This

```typescript
// Don't create multiple fromEvent instances for the same event
const clicks1 = fromEvent(button, 'click') // Creates listener #1
const clicks2 = fromEvent(button, 'click') // Creates listener #2

// This defeats the purpose of shared listeners
```

## Testing

The shared listener behavior is thoroughly tested:

```typescript
it('should handle multiple subscribers to the same event', () => {
  const clickEvents = fromEvent(element, 'click')
  const results1: Event[] = []
  const results2: Event[] = []

  const unsub1 = clickEvents.subscribe(event => results1.push(event))
  const unsub2 = clickEvents.subscribe(event => results2.push(event))

  // Both should receive the same event
  const clickEvent = new Event('click')
  element.dispatchEvent(clickEvent)

  expect(results1).toEqual([clickEvent])
  expect(results2).toEqual([clickEvent])
})

it('should properly cleanup event listeners when all subscribers unsubscribe', () => {
  const clickEvents = fromEvent(element, 'click')
  
  expect(element.getListenerCount('click')).toBe(0)

  const unsub1 = clickEvents.subscribe(() => {})
  expect(element.getListenerCount('click')).toBe(1)

  const unsub2 = clickEvents.subscribe(() => {})
  expect(element.getListenerCount('click')).toBe(1) // Same listener reused

  unsub1()
  expect(element.getListenerCount('click')).toBe(1) // Still one subscriber

  unsub2()
  expect(element.getListenerCount('click')).toBe(0) // All subscribers gone
})
```

## Conclusion

The shared listener behavior in rxDB2's `fromEvent()` provides significant benefits over traditional implementations:

- **Better Performance**: Fewer event handlers to manage
- **Lower Memory Usage**: Shared resources across subscriptions  
- **Automatic Cleanup**: No memory leaks or manual cleanup required
- **Developer Friendly**: Predictable, efficient behavior out of the box

This design choice aligns with rxDB2's philosophy of providing efficient, composable primitives that work well in real-world applications. 