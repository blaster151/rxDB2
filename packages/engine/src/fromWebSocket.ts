import { Reactive } from './reactive'
import { createObservable } from './createObservable'

// WebSocket configuration options
export interface WebSocketOptions {
  retry?: number
  backoff?: (attempt: number) => number
  protocols?: string | string[]
  autoReconnect?: boolean
}

// WebSocket connection state with reactive stream
interface WebSocketState {
  socket: WebSocket | null
  subscriberCount: number
  retryCount: number
  maxRetries: number
  backoffFn: (attempt: number) => number
  autoReconnect: boolean
  isIntentionalClose: boolean
  messageStream: ReturnType<typeof createObservable<string | null>>
}

// Global connection cache to ensure one connection per URL
const connectionCache = new Map<string, WebSocketState>()

/**
 * Creates a Reactive<string> from a WebSocket connection
 * @param url - The WebSocket URL to connect to
 * @param options - Configuration options for the connection
 * @returns Reactive<string> that emits WebSocket messages
 */
export function fromWebSocket(
  url: string,
  options: WebSocketOptions = {}
): Reactive<string> {
  const {
    retry = 0,
    backoff = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 30000),
    protocols,
    autoReconnect = false
  } = options

  // Get or create connection state for this URL
  let state = connectionCache.get(url)
  if (!state) {
    const messageStream = createObservable<string | null>(null)
    state = {
      socket: null,
      subscriberCount: 0,
      retryCount: 0,
      maxRetries: retry,
      backoffFn: backoff,
      autoReconnect,
      isIntentionalClose: false,
      messageStream
    }
    connectionCache.set(url, state)
  }

  // Create the reactive stream that wraps the message stream
  const result = {
    ...state.messageStream,
    subscribe(callback: (value: string | null) => void) {
      const unsub = state!.messageStream.subscribe(callback)
      
      // Increment subscriber count
      state!.subscriberCount++
      
      // Connect if this is the first subscriber
      if (state!.subscriberCount === 1) {
        connectWebSocket(url, state!, protocols)
      }
      
      return () => {
        unsub()
        state!.subscriberCount--
        
        // Close connection if this was the last subscriber
        if (state!.subscriberCount === 0) {
          closeWebSocket(state!)
          connectionCache.delete(url)
        }
      }
    }
  } as Reactive<string>
  
  return result
}

function connectWebSocket(url: string, state: WebSocketState, protocols?: string | string[]) {
  try {
    state.socket = new WebSocket(url, protocols)
    state.isIntentionalClose = false
    
    state.socket.onmessage = (event) => {
      // Emit the message data to all subscribers
      const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
      state.messageStream.set(data)
    }
    
    state.socket.onopen = () => {
      // Reset retry count on successful connection
      state.retryCount = 0
    }
    
    state.socket.onclose = (event) => {
      if (!state.isIntentionalClose && state.autoReconnect && state.retryCount < state.maxRetries) {
        // Attempt to reconnect
        setTimeout(() => {
          state.retryCount++
          connectWebSocket(url, state, protocols)
        }, state.backoffFn(state.retryCount))
      }
    }
    
    state.socket.onerror = (error) => {
      // Handle error - could emit error event or log
      console.error('WebSocket error:', error)
    }
    
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error)
  }
}

function closeWebSocket(state: WebSocketState) {
  if (state.socket) {
    state.isIntentionalClose = true
    state.socket.close()
    state.socket = null
  }
}

/**
 * Send data through the WebSocket connection
 * @param url - The WebSocket URL
 * @param data - Data to send
 */
export function sendWebSocketMessage(url: string, data: string | ArrayBuffer | Blob) {
  const state = connectionCache.get(url)
  if (state?.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(data)
  } else {
    throw new Error(`WebSocket connection to ${url} is not open`)
  }
}

/**
 * Close a WebSocket connection manually
 * @param url - The WebSocket URL
 */
export function closeWebSocketConnection(url: string) {
  const state = connectionCache.get(url)
  if (state) {
    closeWebSocket(state)
    connectionCache.delete(url)
  }
} 