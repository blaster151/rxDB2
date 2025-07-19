import { fromEvent } from '../packages/engine/src/fromEvent'

// Example 1: DOM Events
console.log('=== DOM Events Example ===')

// In a real browser environment, you would do:
// const button = document.getElementById('myButton')
// const clickEvents = fromEvent(button, 'click')
// 
// clickEvents.subscribe(event => {
//   console.log('Button clicked!', event)
// })

// Example 2: Node.js EventEmitter
console.log('=== Node.js EventEmitter Example ===')

// Mock EventEmitter for demonstration
class EventEmitter {
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
}

// Create an EventEmitter instance
const emitter = new EventEmitter()

// Create a reactive stream from the 'data' event
const dataEvents = fromEvent(emitter, 'data')

// Subscribe to the events
const unsubscribe = dataEvents.subscribe(args => {
  console.log('Received data event:', args)
})

// Emit some events
emitter.emit('data', 'hello', 123)
emitter.emit('data', 'world', 456)

// Unsubscribe when done
unsubscribe()

console.log('Example completed!')

// Example 3: Multiple subscribers
console.log('=== Multiple Subscribers Example ===')

const errorEvents = fromEvent(emitter, 'error')

const unsub1 = errorEvents.subscribe(args => {
  console.log('Subscriber 1 received error:', args)
})

const unsub2 = errorEvents.subscribe(args => {
  console.log('Subscriber 2 received error:', args)
})

// Both subscribers will receive the same event
emitter.emit('error', new Error('Something went wrong'))

unsub1()
unsub2()

console.log('Multiple subscribers example completed!') 