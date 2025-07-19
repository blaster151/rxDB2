# fromEvent Function

The `fromEvent` function connects Reactive<T> to real-world event emitters, including DOM events and Node.js EventEmitter instances.

## Features

- ✅ **DOM Events**: Connect to any DOM element events (click, input, keydown, etc.)
- ✅ **Node.js EventEmitter**: Connect to Node.js EventEmitter instances
- ✅ **Shared Listeners**: Multiple subscribers share ONE underlying event listener (memory efficient)
- ✅ **Proper Teardown**: Automatic cleanup of event listeners when subscribers unsubscribe
- ✅ **Reference Counting**: Listener is only removed when the last subscriber disconnects
- ✅ **TypeScript Support**: Full type safety with proper event type inference
- ✅ **No Initial Value**: Event streams don't emit initial values, only actual events

## Usage

### DOM Events

```typescript
import { fromEvent } from '@rxdb2/engine'

// Connect to button click events
const button = document.getElementById('myButton')
const clickEvents = fromEvent(button, 'click')

// Subscribe to click events
const unsubscribe = clickEvents.subscribe(event => {
  console.log('Button clicked!', event)
})

// Later, unsubscribe to clean up
unsubscribe()
```

### Node.js EventEmitter

```typescript
import { fromEvent } from '@rxdb2/engine'
import { EventEmitter } from 'events'

const emitter = new EventEmitter()
const dataEvents = fromEvent(emitter, 'data')

// Subscribe to data events
const unsubscribe = dataEvents.subscribe(args => {
  console.log('Received data:', args)
})

// Emit events
emitter.emit('data', 'hello', 123)
emitter.emit('data', 'world', 456)

// Clean up
unsubscribe()
```

### Multiple Subscribers

```typescript
const clickEvents = fromEvent(button, 'click')

// Multiple subscribers to the same event
const unsub1 = clickEvents.subscribe(event => console.log('Subscriber 1:', event))
const unsub2 = clickEvents.subscribe(event => console.log('Subscriber 2:', event))

// Both receive the same events
button.click()

// Clean up both
unsub1()
unsub2()
```

### Shared Listener Behavior ⚡

**Key Difference from RxJS**: Our `fromEvent()` uses **shared listeners** with reference counting:

```typescript
// rxDB2: Multiple subscribers share ONE listener
const clicks = fromEvent(button, 'click')

const sub1 = clicks.subscribe(console.log) // Adds listener #1
const sub2 = clicks.subscribe(console.log) // Reuses listener #1

// Result: 1 listener attached to button (memory efficient)
// vs RxJS: 2 separate listeners (higher memory usage)
```

**Benefits:**
- ✅ **Memory Efficient**: One listener instead of multiple
- ✅ **Better Performance**: Single event handler processes all subscriptions  
- ✅ **Automatic Cleanup**: Listener removed when last subscriber disconnects
- ✅ **No Memory Leaks**: Reference counting ensures proper cleanup

### Event Listener Options

```typescript
// Use capture phase for DOM events
const clickEvents = fromEvent(button, 'click', { capture: true })

// Use passive listeners for better performance
const scrollEvents = fromEvent(window, 'scroll', { passive: true })
```

## API Reference

### fromEvent(target, eventName, options?)

Creates a Reactive<T> from an event source.

#### Parameters

- `target`: DOMEventTarget | EventEmitter - The event source
- `eventName`: string - The event name to listen for
- `options?`: AddEventListenerOptions - Options for DOM event listeners (optional)

#### Returns

- `Reactive<T>` - A reactive stream that emits events

#### Type Overloads

```typescript
// DOM events with typed event names
fromEvent<T extends keyof DOMEventMap>(
  target: DOMEventTarget,
  eventName: T,
  options?: AddEventListenerOptions
): Reactive<DOMEventMap[T]>

// DOM events with custom event names
fromEvent(
  target: DOMEventTarget,
  eventName: string,
  options?: AddEventListenerOptions
): Reactive<Event>

// Node.js EventEmitter events
fromEvent(
  emitter: EventEmitter,
  eventName: string
): Reactive<any[]>
```

## Supported Event Types

### DOM Events
- `click` → MouseEvent
- `input` → Event
- `change` → Event
- `submit` → Event
- `keydown` → KeyboardEvent
- `keyup` → KeyboardEvent
- `mousedown` → MouseEvent
- `mouseup` → MouseEvent
- `mousemove` → MouseEvent
- `scroll` → Event
- `resize` → Event
- `load` → Event
- `error` → Event
- `focus` → FocusEvent
- `blur` → FocusEvent
- And any custom event name → Event

### Node.js EventEmitter
- Any event name → Array of event arguments

## Memory Management

The `fromEvent` function automatically manages event listeners:

1. **Lazy Binding**: Event listeners are only added when the first subscriber connects
2. **Shared Listeners**: Multiple subscribers share the same underlying event listener
3. **Automatic Cleanup**: Event listeners are removed when the last subscriber unsubscribes
4. **Reference Counting**: Proper subscriber counting ensures no memory leaks

## Error Handling

- Throws an error if the target is neither a DOM EventTarget nor a Node.js EventEmitter
- Gracefully handles multiple unsubscribe calls on the same subscription
- Safe to use with any standard DOM element or EventEmitter implementation

## Performance Considerations

- Event listeners are shared between multiple subscribers for efficiency
- No initial value emission for event streams (unlike regular reactive values)
- Passive event listeners can be used for better scroll performance
- Minimal overhead compared to manual event listener management 