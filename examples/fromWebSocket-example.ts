import { fromWebSocket, sendWebSocketMessage, closeWebSocketConnection } from '../packages/engine/src/fromWebSocket'

console.log('=== WebSocket Examples ===')

// Example 1: Basic WebSocket connection
console.log('\n--- Basic WebSocket Connection ---')

// In a real environment, you would connect to an actual WebSocket server
// const chatStream = fromWebSocket('ws://localhost:8080/chat')
// 
// const unsub = chatStream.subscribe(message => {
//   console.log('Received message:', message)
// })

// Example 2: WebSocket with auto-reconnection
console.log('\n--- WebSocket with Auto-Reconnection ---')

const resilientStream = fromWebSocket('ws://example.com/stream', {
  autoReconnect: true,
  retry: 5,
  backoff: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000) // Exponential backoff, max 30s
})

const unsubResilient = resilientStream.subscribe(message => {
  console.log('Resilient stream message:', message)
})

// Example 3: Multiple subscribers to the same WebSocket
console.log('\n--- Multiple Subscribers ---')

const sharedStream = fromWebSocket('ws://example.com/shared')

// First subscriber
const unsub1 = sharedStream.subscribe(message => {
  console.log('Subscriber 1 received:', message)
})

// Second subscriber (shares the same connection)
const unsub2 = sharedStream.subscribe(message => {
  console.log('Subscriber 2 received:', message)
})

// Example 4: Sending messages
console.log('\n--- Sending Messages ---')

const sendStream = fromWebSocket('ws://example.com/echo')

const unsubSend = sendStream.subscribe(message => {
  console.log('Echo response:', message)
})

// In a real scenario, you would send messages like this:
// sendWebSocketMessage('ws://example.com/echo', 'Hello, WebSocket!')
// sendWebSocketMessage('ws://example.com/echo', JSON.stringify({ type: 'ping', data: 'test' }))

// Example 5: Filtering messages by type
console.log('\n--- Message Filtering ---')

const chatStream = fromWebSocket('ws://example.com/chat')

// Filter for chat messages only
const chatMessages = chatStream.filter(message => {
  try {
    const parsed = JSON.parse(message)
    return parsed.type === 'chat'
  } catch {
    return false
  }
})

const unsubChat = chatMessages.subscribe(message => {
  console.log('Chat message:', message)
})

// Example 6: Error handling
console.log('\n--- Error Handling ---')

const errorStream = fromWebSocket('ws://invalid-url.com')

const unsubError = errorStream.subscribe(message => {
  console.log('Message:', message)
})

// Example 7: Manual connection management
console.log('\n--- Manual Connection Management ---')

const manualStream = fromWebSocket('ws://example.com/manual')

const unsubManual = manualStream.subscribe(message => {
  console.log('Manual stream message:', message)
})

// Later, manually close the connection
// closeWebSocketConnection('ws://example.com/manual')

// Example 8: WebSocket with custom protocols
console.log('\n--- Custom Protocols ---')

const protocolStream = fromWebSocket('ws://example.com/protocol', {
  protocols: ['my-custom-protocol']
})

const unsubProtocol = protocolStream.subscribe(message => {
  console.log('Protocol message:', message)
})

// Cleanup all subscriptions
console.log('\n--- Cleanup ---')

// In a real application, you would clean up when done
// unsubResilient()
// unsub1()
// unsub2()
// unsubSend()
// unsubChat()
// unsubError()
// unsubManual()
// unsubProtocol()

console.log('Examples completed!')

// Example 9: Real-world chat application pattern
console.log('\n--- Chat Application Pattern ---')

class ChatClient {
  private messageStream: ReturnType<typeof fromWebSocket>
  private unsub: (() => void) | null = null

  constructor(private url: string) {
    this.messageStream = fromWebSocket(url, {
      autoReconnect: true,
      retry: 3
    })
  }

  connect(onMessage: (message: string) => void) {
    this.unsub = this.messageStream.subscribe(message => {
      if (message) onMessage(message)
    })
  }

  sendMessage(message: string) {
    sendWebSocketMessage(this.url, JSON.stringify({
      type: 'chat',
      message,
      timestamp: Date.now()
    }))
  }

  disconnect() {
    if (this.unsub) {
      this.unsub()
      this.unsub = null
    }
  }
}

// Usage example:
// const chat = new ChatClient('ws://localhost:8080/chat')
// chat.connect(message => console.log('Chat:', message))
// chat.sendMessage('Hello, everyone!')
// chat.disconnect() 