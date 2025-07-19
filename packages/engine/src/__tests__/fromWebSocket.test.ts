import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fromWebSocket, sendWebSocketMessage, closeWebSocketConnection } from '../fromWebSocket'

// Mock WebSocket class for testing
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static reset() {
    FakeWebSocket.instances = []
  }

  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { wasClean: boolean }) => void) | null = null
  onerror: ((error: any) => void) | null = null
  onopen: (() => void) | null = null
  readyState: number = WebSocket.CONNECTING
  sent: any[] = []

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.()
    }, 0)
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

  emitError(error: any) {
    this.onerror?.(error)
  }

  simulateClose(wasClean = true) {
    this.readyState = WebSocket.CLOSED
    this.onclose?.({ wasClean })
  }
}

// Mock global WebSocket
const originalWebSocket = globalThis.WebSocket
beforeEach(() => {
  FakeWebSocket.reset()
  ;(globalThis as any).WebSocket = FakeWebSocket
})

afterEach(() => {
  ;(globalThis as any).WebSocket = originalWebSocket
})

describe('fromWebSocket', () => {
  describe('Basic WebSocket functionality', () => {
    it('should create a WebSocket connection on first subscription', () => {
      const stream = fromWebSocket('ws://test.com')
      
      expect(FakeWebSocket.instances).toHaveLength(0)
      
      const unsub = stream.subscribe(() => {})
      
      expect(FakeWebSocket.instances).toHaveLength(1)
      expect(FakeWebSocket.instances[0].url).toBe('ws://test.com')
      
      unsub()
    })

    it('should emit messages when WebSocket receives data', () => {
      const stream = fromWebSocket('ws://test.com')
      const messages: string[] = []
      
      const unsub = stream.subscribe(msg => {
        if (msg) messages.push(msg)
      })
      
      // Wait for connection to open
      setTimeout(() => {
        FakeWebSocket.instances[0].emitMessage('hello')
        FakeWebSocket.instances[0].emitMessage('world')
      }, 10)
      
      // Wait for messages to be processed
      setTimeout(() => {
        expect(messages).toEqual(['hello', 'world'])
        unsub()
      }, 20)
    })

    it('should close WebSocket when all subscribers unsubscribe', () => {
      const stream = fromWebSocket('ws://test.com')
      
      const unsub1 = stream.subscribe(() => {})
      const unsub2 = stream.subscribe(() => {})
      
      expect(FakeWebSocket.instances).toHaveLength(1)
      
      unsub1()
      expect(FakeWebSocket.instances[0].readyState).toBe(WebSocket.OPEN)
      
      unsub2()
      expect(FakeWebSocket.instances[0].readyState).toBe(WebSocket.CLOSED)
    })

    it('should share the same connection for multiple subscribers to the same URL', () => {
      const stream1 = fromWebSocket('ws://test.com')
      const stream2 = fromWebSocket('ws://test.com')
      
      const unsub1 = stream1.subscribe(() => {})
      const unsub2 = stream2.subscribe(() => {})
      
      expect(FakeWebSocket.instances).toHaveLength(1)
      
      unsub1()
      unsub2()
    })

    it('should create separate connections for different URLs', () => {
      const stream1 = fromWebSocket('ws://test1.com')
      const stream2 = fromWebSocket('ws://test2.com')
      
      const unsub1 = stream1.subscribe(() => {})
      const unsub2 = stream2.subscribe(() => {})
      
      expect(FakeWebSocket.instances).toHaveLength(2)
      expect(FakeWebSocket.instances[0].url).toBe('ws://test1.com')
      expect(FakeWebSocket.instances[1].url).toBe('ws://test2.com')
      
      unsub1()
      unsub2()
    })
  })

  describe('Message handling', () => {
    it('should handle string messages', () => {
      const stream = fromWebSocket('ws://test.com')
      const messages: string[] = []
      
      const unsub = stream.subscribe(msg => {
        if (msg) messages.push(msg)
      })
      
      setTimeout(() => {
        FakeWebSocket.instances[0].emitMessage('simple string')
      }, 10)
      
      setTimeout(() => {
        expect(messages).toEqual(['simple string'])
        unsub()
      }, 20)
    })

    it('should handle JSON messages', () => {
      const stream = fromWebSocket('ws://test.com')
      const messages: string[] = []
      
      const unsub = stream.subscribe(msg => {
        if (msg) messages.push(msg)
      })
      
      setTimeout(() => {
        const jsonData = { type: 'chat', message: 'hello' }
        FakeWebSocket.instances[0].emitMessage(JSON.stringify(jsonData))
      }, 10)
      
      setTimeout(() => {
        expect(messages).toEqual(['{"type":"chat","message":"hello"}'])
        unsub()
      }, 20)
    })
  })

  describe('Error handling', () => {
    it('should handle WebSocket errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const stream = fromWebSocket('ws://test.com')
      const unsub = stream.subscribe(() => {})
      
      setTimeout(() => {
        FakeWebSocket.instances[0].emitError(new Error('Connection failed'))
      }, 10)
      
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', expect.any(Error))
        consoleSpy.mockRestore()
        unsub()
      }, 20)
    })
  })

  describe('Retry and reconnection', () => {
    it('should not reconnect by default when connection closes', () => {
      const stream = fromWebSocket('ws://test.com')
      const unsub = stream.subscribe(() => {})
      
      setTimeout(() => {
        FakeWebSocket.instances[0].simulateClose()
      }, 10)
      
      setTimeout(() => {
        expect(FakeWebSocket.instances).toHaveLength(1)
        unsub()
      }, 50)
    })

    it('should reconnect with backoff when autoReconnect is enabled', () => {
      vi.useFakeTimers()
      
      const stream = fromWebSocket('ws://test.com', {
        autoReconnect: true,
        retry: 3,
        backoff: (attempt) => 100 * Math.pow(2, attempt)
      })
      
      const unsub = stream.subscribe(() => {})
      
      // Initial connection
      expect(FakeWebSocket.instances).toHaveLength(1)
      
      // Close connection
      FakeWebSocket.instances[0].simulateClose()
      
      // Advance time to trigger first retry
      vi.advanceTimersByTime(200)
      expect(FakeWebSocket.instances).toHaveLength(2)
      
      // Close again
      FakeWebSocket.instances[1].simulateClose()
      
      // Advance time to trigger second retry
      vi.advanceTimersByTime(400)
      expect(FakeWebSocket.instances).toHaveLength(3)
      
      vi.useRealTimers()
      unsub()
    })
  })

  describe('Utility functions', () => {
    it('should send messages via sendWebSocketMessage', () => {
      const stream = fromWebSocket('ws://test.com')
      const unsub = stream.subscribe(() => {})
      
      setTimeout(() => {
        sendWebSocketMessage('ws://test.com', 'hello')
        expect(FakeWebSocket.instances[0].sent).toEqual(['hello'])
        unsub()
      }, 10)
    })

    it('should throw error when sending to closed connection', () => {
      const stream = fromWebSocket('ws://test.com')
      const unsub = stream.subscribe(() => {})
      
      setTimeout(() => {
        FakeWebSocket.instances[0].close()
        
        expect(() => {
          sendWebSocketMessage('ws://test.com', 'hello')
        }).toThrow('WebSocket connection to ws://test.com is not open')
        
        unsub()
      }, 10)
    })

    it('should close connection via closeWebSocketConnection', () => {
      const stream = fromWebSocket('ws://test.com')
      const unsub = stream.subscribe(() => {})
      
      setTimeout(() => {
        closeWebSocketConnection('ws://test.com')
        expect(FakeWebSocket.instances[0].readyState).toBe(WebSocket.CLOSED)
        unsub()
      }, 10)
    })
  })

  describe('Memory management', () => {
    it('should not emit initial value', () => {
      const stream = fromWebSocket('ws://test.com')
      const messages: string[] = []
      
      const unsub = stream.subscribe(msg => {
        messages.push(msg || 'null')
      })
      
      // Should not emit initial value
      expect(messages).toEqual([])
      
      unsub()
    })

    it('should handle multiple unsubscribes safely', () => {
      const stream = fromWebSocket('ws://test.com')
      const unsub = stream.subscribe(() => {})
      
      unsub()
      unsub() // Should not throw
      unsub() // Should not throw
    })
  })
}) 