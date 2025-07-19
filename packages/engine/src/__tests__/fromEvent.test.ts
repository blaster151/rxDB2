import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fromEvent } from '../fromEvent'

// Mock EventEmitter for Node.js testing
class MockEventEmitter {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map()

  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return this
  }

  off(event: string, listener: (...args: any[]) => void): this {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(listener)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
    return this
  }

  removeListener(event: string, listener: (...args: any[]) => void): this {
    return this.off(event, listener)
  }

  addListener(event: string, listener: (...args: any[]) => void): this {
    return this.on(event, listener)
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args))
    }
  }

  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0
  }
}

// Mock DOM element for browser testing
class MockDOMElement {
  private listeners: Map<string, Set<EventListener>> = new Map()

  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions): void {
    const eventListeners = this.listeners.get(type)
    if (eventListeners) {
      eventListeners.delete(listener)
      if (eventListeners.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    const eventListeners = this.listeners.get(event.type)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(event))
    }
    return true
  }

  getListenerCount(type: string): number {
    return this.listeners.get(type)?.size || 0
  }
}

describe('fromEvent', () => {
  describe('DOM Events', () => {
    let element: MockDOMElement

    beforeEach(() => {
      element = new MockDOMElement()
    })

    it('should create a Reactive from DOM click events', () => {
      const clickEvents = fromEvent(element, 'click')
      const results: Event[] = []

      const unsub = clickEvents.subscribe(event => {
        results.push(event)
      })

      // Should not emit initial value for DOM events
      expect(results).toEqual([])

      // Simulate click events
      const clickEvent = new Event('click')
      element.dispatchEvent(clickEvent)
      expect(results).toEqual([clickEvent])

      const clickEvent2 = new Event('click')
      element.dispatchEvent(clickEvent2)
      expect(results).toEqual([clickEvent, clickEvent2])

      unsub()
    })

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

      unsub1()
      unsub2()
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

    it('should handle different event types', () => {
      const inputEvents = fromEvent(element, 'input')
      const changeEvents = fromEvent(element, 'change')
      
      const inputResults: Event[] = []
      const changeResults: Event[] = []

      const unsubInput = inputEvents.subscribe(event => inputResults.push(event))
      const unsubChange = changeEvents.subscribe(event => changeResults.push(event))

      const inputEvent = new Event('input')
      const changeEvent = new Event('change')

      element.dispatchEvent(inputEvent)
      element.dispatchEvent(changeEvent)

      expect(inputResults).toEqual([inputEvent])
      expect(changeResults).toEqual([changeEvent])

      unsubInput()
      unsubChange()
    })

    it('should support event listener options', () => {
      const clickEvents = fromEvent(element, 'click', { capture: true })
      const results: Event[] = []

      const unsub = clickEvents.subscribe(event => results.push(event))

      const clickEvent = new Event('click')
      element.dispatchEvent(clickEvent)

      expect(results).toEqual([clickEvent])
      expect(element.getListenerCount('click')).toBe(1)

      unsub()
    })
  })

  describe('Node.js EventEmitter', () => {
    let emitter: MockEventEmitter

    beforeEach(() => {
      emitter = new MockEventEmitter()
    })

    it('should create a Reactive from EventEmitter events', () => {
      const dataEvents = fromEvent(emitter, 'data')
      const results: any[][] = []

      const unsub = dataEvents.subscribe(args => {
        results.push(args)
      })

      // Should not emit initial value for EventEmitter events
      expect(results).toEqual([])

      // Emit events with arguments
      emitter.emit('data', 'hello', 123)
      expect(results).toEqual([['hello', 123]])

      emitter.emit('data', 'world', 456)
      expect(results).toEqual([['hello', 123], ['world', 456]])

      unsub()
    })

    it('should handle multiple subscribers to the same EventEmitter event', () => {
      const dataEvents = fromEvent(emitter, 'data')
      const results1: any[][] = []
      const results2: any[][] = []

      const unsub1 = dataEvents.subscribe(args => results1.push(args))
      const unsub2 = dataEvents.subscribe(args => results2.push(args))

      emitter.emit('data', 'test', 42)

      expect(results1).toEqual([['test', 42]])
      expect(results2).toEqual([['test', 42]])

      unsub1()
      unsub2()
    })

    it('should properly cleanup EventEmitter listeners when all subscribers unsubscribe', () => {
      const dataEvents = fromEvent(emitter, 'data')
      
      expect(emitter.getListenerCount('data')).toBe(0)

      const unsub1 = dataEvents.subscribe(() => {})
      expect(emitter.getListenerCount('data')).toBe(1)

      const unsub2 = dataEvents.subscribe(() => {})
      expect(emitter.getListenerCount('data')).toBe(1) // Same listener reused

      unsub1()
      expect(emitter.getListenerCount('data')).toBe(1) // Still one subscriber

      unsub2()
      expect(emitter.getListenerCount('data')).toBe(0) // All subscribers gone
    })

    it('should handle different EventEmitter event types', () => {
      const dataEvents = fromEvent(emitter, 'data')
      const errorEvents = fromEvent(emitter, 'error')
      
      const dataResults: any[][] = []
      const errorResults: any[][] = []

      const unsubData = dataEvents.subscribe(args => dataResults.push(args))
      const unsubError = errorEvents.subscribe(args => errorResults.push(args))

      emitter.emit('data', 'success')
      emitter.emit('error', new Error('test error'))

      expect(dataResults).toEqual([['success']])
      expect(errorResults).toEqual([[new Error('test error')]])

      unsubData()
      unsubError()
    })

    it('should handle events with no arguments', () => {
      const readyEvents = fromEvent(emitter, 'ready')
      const results: any[][] = []

      const unsub = readyEvents.subscribe(args => results.push(args))

      emitter.emit('ready')
      expect(results).toEqual([[]])

      unsub()
    })
  })

  describe('Error handling', () => {
    it('should throw error for invalid target', () => {
      const invalidTarget = {} as any

      expect(() => {
        fromEvent(invalidTarget, 'test')
      }).toThrow('fromEvent: target must be a DOM EventTarget or Node.js EventEmitter')
    })

    it('should handle multiple unsubscribes safely', () => {
      const element = new MockDOMElement()
      const clickEvents = fromEvent(element, 'click')
      
      const unsub = clickEvents.subscribe(() => {})

      unsub()
      unsub() // Should not throw
      unsub() // Should not throw

      expect(element.getListenerCount('click')).toBe(0)
    })
  })

  describe('TypeScript support', () => {
    it('should provide proper typing for DOM events', () => {
      const element = new MockDOMElement()
      
      // These should compile with proper types
      const clickEvents = fromEvent(element, 'click') // Reactive<MouseEvent>
      const inputEvents = fromEvent(element, 'input') // Reactive<Event>
      const keydownEvents = fromEvent(element, 'keydown') // Reactive<KeyboardEvent>
      
      expect(clickEvents).toBeDefined()
      expect(inputEvents).toBeDefined()
      expect(keydownEvents).toBeDefined()
    })

    it('should provide proper typing for EventEmitter events', () => {
      const emitter = new MockEventEmitter()
      
      // This should compile with proper types
      const dataEvents = fromEvent(emitter, 'data') // Reactive<any[]>
      
      expect(dataEvents).toBeDefined()
    })
  })
}) 