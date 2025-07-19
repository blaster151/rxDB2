import { Reactive } from './reactive'
import { createObservable } from './createObservable'

/**
 * Creates a Reactive<T> from a Promise
 * @param promise - The Promise to convert to a reactive stream
 * @returns Reactive<T> that emits the resolved value then completes
 */
export function fromPromise<T>(promise: Promise<T>): Reactive<T> {
  // Create a custom reactive that doesn't emit initial value
  const base = createObservable<T | null>(null)
  let isCompleted = false
  let isCancelled = false
  
  // Start the promise immediately
  promise
    .then(value => {
      if (!isCancelled && !isCompleted) {
        base.set(value)
        isCompleted = true
      }
    })
    .catch(error => {
      if (!isCancelled && !isCompleted) {
        // For now, we'll just log the error
        // In a more sophisticated implementation, we could emit error events
        console.error('Promise rejected:', error)
        isCompleted = true
      }
    })
  
  const result = {
    ...base,
    subscribe(callback: (value: T | null) => void) {
      const unsub = base.subscribe(callback)
      
      return () => {
        unsub()
        // Mark as cancelled to prevent future emissions
        isCancelled = true
      }
    }
  } as Reactive<T>
  
  return result
}

/**
 * Creates a Reactive<T> from an async function
 * @param asyncFn - The async function to execute
 * @returns Reactive<T> that emits the resolved value then completes
 */
export function fromAsync<T>(asyncFn: () => Promise<T>): Reactive<T> {
  return fromPromise(asyncFn())
}

/**
 * Creates a Reactive<T> from a Promise with error handling
 * @param promise - The Promise to convert to a reactive stream
 * @returns Reactive<T | Error> that emits either the resolved value or an error
 */
export function fromPromiseWithError<T>(promise: Promise<T>): Reactive<T | Error> {
  const base = createObservable<T | Error | null>(null)
  let isCompleted = false
  let isCancelled = false
  
  promise
    .then(value => {
      if (!isCancelled && !isCompleted) {
        base.set(value)
        isCompleted = true
      }
    })
    .catch(error => {
      if (!isCancelled && !isCompleted) {
        base.set(error instanceof Error ? error : new Error(String(error)))
        isCompleted = true
      }
    })
  
  const result = {
    ...base,
    subscribe(callback: (value: T | Error | null) => void) {
      const unsub = base.subscribe(callback)
      
      return () => {
        unsub()
        isCancelled = true
      }
    }
  } as Reactive<T | Error>
  
  return result
} 