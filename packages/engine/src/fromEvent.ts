import { Reactive, reactive } from './reactive'
import { createObservable } from './createObservable'

// DOM Event types
type DOMEventTarget = EventTarget | Element | Window | Document
type DOMEventMap = {
  'click': MouseEvent
  'input': Event
  'change': Event
  'submit': Event
  'keydown': KeyboardEvent
  'keyup': KeyboardEvent
  'mousedown': MouseEvent
  'mouseup': MouseEvent
  'mousemove': MouseEvent
  'scroll': Event
  'resize': Event
  'load': Event
  'error': Event
  'focus': FocusEvent
  'blur': FocusEvent
  [key: string]: Event
}

// Node.js EventEmitter types
interface EventEmitter {
  on(event: string, listener: (...args: any[]) => void): this
  off(event: string, listener: (...args: any[]) => void): this
  removeListener(event: string, listener: (...args: any[]) => void): this
  addListener(event: string, listener: (...args: any[]) => void): this
}

/**
 * Creates a Reactive<T> from DOM events
 * @param target - The DOM element to listen to
 * @param eventName - The event name to listen for
 * @param options - Event listener options (optional)
 * @returns Reactive<Event> that emits DOM events
 */
export function fromEvent<T extends keyof DOMEventMap>(
  target: DOMEventTarget,
  eventName: T,
  options?: AddEventListenerOptions
): Reactive<DOMEventMap[T]>

/**
 * Creates a Reactive<T> from DOM events with custom event name
 * @param target - The DOM element to listen to
 * @param eventName - The event name to listen for
 * @param options - Event listener options (optional)
 * @returns Reactive<Event> that emits DOM events
 */
export function fromEvent(
  target: DOMEventTarget,
  eventName: string,
  options?: AddEventListenerOptions
): Reactive<Event>

/**
 * Creates a Reactive<T> from Node.js EventEmitter events
 * @param emitter - The EventEmitter instance
 * @param eventName - The event name to listen for
 * @returns Reactive<any[]> that emits event arguments as an array
 */
export function fromEvent(
  emitter: EventEmitter,
  eventName: string
): Reactive<any[]>

/**
 * Implementation of fromEvent for both DOM and Node.js EventEmitter
 */
export function fromEvent(
  target: DOMEventTarget | EventEmitter,
  eventName: string,
  options?: AddEventListenerOptions
): Reactive<any> {
  // Check if it's a DOM EventTarget
  if (target && typeof (target as any).addEventListener === 'function') {
    return fromDOMEvent(target as DOMEventTarget, eventName, options)
  }
  
  // Check if it's a Node.js EventEmitter
  if (target && typeof (target as any).on === 'function') {
    return fromEventEmitter(target as EventEmitter, eventName)
  }
  
  throw new Error('fromEvent: target must be a DOM EventTarget or Node.js EventEmitter')
}

function fromDOMEvent<T extends Event>(
  target: DOMEventTarget,
  eventName: string,
  options?: AddEventListenerOptions
): Reactive<T> {
  // Create a custom reactive that doesn't emit initial value for events
  const base = createObservable<T | null>(null)
  let subscriberCount = 0
  let eventListener: ((event: T) => void) | null = null
  
  const handleEvent = (event: T) => {
    base.set(event)
  }
  
  // Override subscribe to not emit initial value and manage event listeners
  const result = {
    ...base,
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
  } as Reactive<T>
  
  return result
}

function fromEventEmitter(
  emitter: EventEmitter,
  eventName: string
): Reactive<any[]> {
  // Create a custom reactive that doesn't emit initial value for events
  const base = createObservable<any[] | null>(null)
  let subscriberCount = 0
  let eventListener: ((...args: any[]) => void) | null = null
  
  const handleEvent = (...args: any[]) => {
    base.set(args)
  }
  
  // Override subscribe to not emit initial value and manage event listeners
  const result = {
    ...base,
    subscribe(callback: (value: any[] | null) => void) {
      const unsub = base.subscribe(callback)
      
      // Only add event listener once when first subscriber connects
      if (subscriberCount === 0) {
        eventListener = handleEvent
        emitter.on(eventName, eventListener)
      }
      subscriberCount++
      
      return () => {
        unsub()
        subscriberCount--
        
        // Remove event listener when last subscriber disconnects
        if (subscriberCount === 0 && eventListener) {
          emitter.off(eventName, eventListener)
          eventListener = null
        }
      }
    }
  } as Reactive<any[]>
  
  return result
} 