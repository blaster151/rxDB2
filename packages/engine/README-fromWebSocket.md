# fromWebSocket Function

The `fromWebSocket` function creates a Reactive<string> from WebSocket connections with automatic connection management, retry logic, and multicast semantics.

## Features

- ✅ **Lazy Connection**: Only connects when first subscriber subscribes
- ✅ **Multicast Semantics**: One connection per URL, shared between multiple subscribers
- ✅ **Automatic Teardown**: Closes connection when all subscribers unsubscribe
- ✅ **Retry/Backoff**: Configurable auto-reconnection with exponential backoff
- ✅ **Message Sending**: Utility functions for sending messages
- ✅ **Error Handling**: Graceful error handling and logging
- ✅ **Memory Management**: No memory leaks, proper cleanup

## Core Behavior (MVP)

### Connection Initialization

- **Lazy Connection**: WebSocket connection is only opened when the first subscriber subscribes
- **Message Emission**: On WebSocket message, emits `event.data` as string
- **Connection Lifecycle**: Handles open, close, and error events appropriately

### Multicast Semantics

- **Single Connection**: Only one WebSocket connection per URL, even with multiple subscribers
- **Shared Stream**: Each subscriber receives the same stream of messages
- **Reference Counting**: Connection is closed when all subscribers unsubscribe

### Teardown Logic

- **Automatic Cleanup**: Calls `socket.close()` when last subscriber unsubscribes
- **Event Listener Cleanup**: Removes all event listeners (message, error, close)
- **Memory Management**: Clears connection cache entries

## Usage

### Basic WebSocket Connection

```typescript
import { fromWebSocket } from '@rxdb2/engine'

// Create a WebSocket stream
const chatStream = fromWebSocket('ws://localhost:8080/chat')

// Subscribe to messages
const unsubscribe = chatStream.subscribe(message => {
  console.log('Received:', message)
})

// Later, unsubscribe to close the connection
unsubscribe()
```

### WebSocket with Auto-Reconnection

```typescript
const resilientStream = fromWebSocket('ws://example.com/stream', {
  autoReconnect: true,
  retry: 5,
  backoff: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000)
})

resilientStream.subscribe(message => {
  console.log('Message:', message)
})
```

### Multiple Subscribers

```typescript
const sharedStream = fromWebSocket('ws://example.com/shared')

// Multiple subscribers share the same connection
const unsub1 = sharedStream.subscribe(msg => console.log('Sub1:', msg))
const unsub2 = sharedStream.subscribe(msg => console.log('Sub2:', msg))

// Both receive the same messages
// Connection closes when both unsubscribe
unsub1()
unsub2()
```

### Sending Messages

```typescript
import { fromWebSocket, sendWebSocketMessage } from '@rxdb2/engine'

const stream = fromWebSocket('ws://example.com/echo')

// Send messages
sendWebSocketMessage('ws://example.com/echo', 'Hello, WebSocket!')
sendWebSocketMessage('ws://example.com/echo', JSON.stringify({ type: 'ping' }))
```

## API Reference

### fromWebSocket(url, options?)

Creates a Reactive<string> from a WebSocket connection.

#### Parameters

- `url`: string - The WebSocket URL to connect to
- `options?`: WebSocketOptions - Configuration options (optional)

#### Returns

- `Reactive<string>` - A reactive stream that emits WebSocket messages

### WebSocketOptions

```typescript
interface WebSocketOptions {
  retry?: number                    // Maximum retry attempts (default: 0)
  backoff?: (attempt: number) => number  // Backoff function (default: exponential)
  protocols?: string | string[]     // WebSocket protocols
  autoReconnect?: boolean          // Enable auto-reconnection (default: false)
}
```

### Utility Functions

#### sendWebSocketMessage(url, data)

Sends data through an existing WebSocket connection.

```typescript
sendWebSocketMessage('ws://example.com', 'Hello')
sendWebSocketMessage('ws://example.com', JSON.stringify({ type: 'chat' }))
```

#### closeWebSocketConnection(url)

Manually closes a WebSocket connection.

```typescript
closeWebSocketConnection('ws://example.com')
```

## Advanced Behavior (Phase 2+)

### 1. Retry / Backoff

Support reconnecting on failure with exponential backoff:

```typescript
const stream = fromWebSocket('ws://example.com', {
  retry: 3,
  backoff: (attempt) => 500 * Math.pow(2, attempt), // 500ms, 1s, 2s
  autoReconnect: true
})
```

- **Reset on Success**: Retry count resets after successful connection
- **No Reconnect on Normal Close**: Only reconnects on unexpected closures
- **Configurable Backoff**: Custom backoff functions supported

### 2. Multiplexing / Channels

Filter messages by type or topic:

```typescript
const stream = fromWebSocket('ws://example.com')

// Filter for chat messages
const chatMessages = stream.filter(message => {
  try {
    const parsed = JSON.parse(message)
    return parsed.type === 'chat'
  } catch {
    return false
  }
})

// Filter for system messages
const systemMessages = stream.filter(message => {
  try {
    const parsed = JSON.parse(message)
    return parsed.type === 'system'
  } catch {
    return false
  }
})
```

## Testing Strategy

### Mock WebSocket Class

```typescript
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { wasClean: boolean }) => void) | null = null
  onerror: ((error: any) => void) | null = null
  readyState: number = WebSocket.OPEN
  sent: any[] = []

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: any) {
    this.sent.push(data)
  }

  close() {
    this.readyState = WebSocket.CLOSED
    this.onclose?.({ wasClean: true })
  }

  emitMessage(data: string) {
    this.onmessage?.({ data })
  }
}
```

### Test Scenarios

- ✅ Emits message when socket emits
- ✅ Closes socket on unsubscribe
- ✅ Only one socket per URL (even with multiple subs)
- ✅ No memory leaks (listeners removed on unsubscribe)
- ✅ Reconnect logic works on failure
- ✅ Error handling works correctly

## Best Practices

### 1. Connection Management

```typescript
// ✅ Good: Lazy connection
const stream = fromWebSocket('ws://example.com')
const unsub = stream.subscribe(msg => console.log(msg))

// ❌ Bad: Don't connect before subscription
// stream.connect() // This doesn't exist
```

### 2. Memory Management

```typescript
// ✅ Good: Always unsubscribe
const unsub = stream.subscribe(msg => console.log(msg))
// ... later
unsub()

// ❌ Bad: Memory leak
stream.subscribe(msg => console.log(msg))
// Never unsubscribe
```

### 3. Error Handling

```typescript
// ✅ Good: Handle connection errors
const stream = fromWebSocket('ws://example.com')
stream.subscribe({
  next: (msg) => console.log('Message:', msg),
  error: (err) => console.error('Connection error:', err)
})
```

### 4. Message Format

```typescript
// ✅ Good: Use structured messages
sendWebSocketMessage('ws://example.com', JSON.stringify({
  type: 'chat',
  message: 'Hello',
  timestamp: Date.now()
}))

// ✅ Good: Keep raw strings for simple protocols
sendWebSocketMessage('ws://example.com', 'PING')
```

## Performance Considerations

- **Shared Connections**: Multiple subscribers share the same WebSocket connection
- **Lazy Loading**: No connection overhead until first subscription
- **Efficient Cleanup**: Automatic cleanup prevents memory leaks
- **Minimal Overhead**: Thin wrapper around native WebSocket API

## Browser Compatibility

- **WebSocket API**: Standard WebSocket API support required
- **Modern Browsers**: Works in all modern browsers
- **Node.js**: Works with Node.js WebSocket implementations
- **Polyfills**: May require WebSocket polyfill for older environments 