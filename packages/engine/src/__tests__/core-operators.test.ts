import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from '../reactive'
import { 
  retry, 
  catchError, 
  startWith, 
  scan,
  combineLatest,
  withLatestFrom,
  switchMap
} from '../operators'

describe('Core Operators', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('retry', () => {
    it('should retry on error up to maxRetries times', () => {
      let attemptCount = 0
      const errorSource = reactive(0)
      
      // Create a source that fails twice then succeeds
      const failingSource = {
        ...errorSource,
        subscribe(callback: (value: number) => void) {
          return errorSource.subscribe((value) => {
            attemptCount++
            if (attemptCount <= 2) {
              throw new Error(`Attempt ${attemptCount} failed`)
            }
            callback(value)
          })
        }
      }

      const retryStream = retry(failingSource, 3)
      const results: number[] = []
      const errors: Error[] = []

      const unsub = retryStream.subscribe(
        (value) => results.push(value),
        (error) => errors.push(error)
      )

      errorSource.set(1)
      errorSource.set(2)
      errorSource.set(3)

      expect(attemptCount).toBe(3)
      expect(results).toEqual([3])
      expect(errors).toEqual([])

      unsub()
    })

    it('should stop retrying after maxRetries reached', () => {
      let attemptCount = 0
      const errorSource = reactive(0)
      
      const alwaysFailingSource = {
        ...errorSource,
        subscribe(callback: (value: number) => void) {
          return errorSource.subscribe((value) => {
            attemptCount++
            throw new Error(`Always fails on attempt ${attemptCount}`)
          })
        }
      }

      const retryStream = retry(alwaysFailingSource, 2)
      const results: number[] = []

      const unsub = retryStream.subscribe((value) => results.push(value))

      errorSource.set(1)
      errorSource.set(2)

      expect(attemptCount).toBe(3) // Initial + 2 retries
      expect(results).toEqual([]) // No successful emissions

      unsub()
    })

    it('should reset retry count on successful emission', () => {
      let attemptCount = 0
      const source = reactive(0)
      
      const sometimesFailingSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            attemptCount++
            if (value === 1) {
              throw new Error('Fails on value 1')
            }
            callback(value)
          })
        }
      }

      const retryStream = retry(sometimesFailingSource, 1)
      const results: number[] = []

      const unsub = retryStream.subscribe((value) => results.push(value))

      source.set(0) // Success
      source.set(1) // Fails, retries once
      source.set(2) // Success again

      expect(results).toEqual([0, 2])
      expect(attemptCount).toBe(3)

      unsub()
    })
  })

  describe('catchError', () => {
    it('should switch to fallback stream on error', () => {
      const source = reactive(0)
      const fallback = reactive('fallback')
      
      const errorSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            if (value === 1) {
              throw new Error('Source error')
            }
            callback(value)
          })
        }
      }

      const catchStream = catchError(errorSource, (error) => fallback)
      const results: (number | string)[] = []

      const unsub = catchStream.subscribe((value) => results.push(value))

      source.set(0) // Success
      source.set(1) // Error, switches to fallback
      fallback.set('new fallback')

      expect(results).toEqual([0, 'fallback', 'new fallback'])

      unsub()
    })

    it('should handle multiple errors', () => {
      const source = reactive(0)
      const fallback = reactive('fallback')
      
      const alwaysErrorSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            throw new Error('Always errors')
          })
        }
      }

      const catchStream = catchError(alwaysErrorSource, (error) => fallback)
      const results: (number | string)[] = []

      const unsub = catchStream.subscribe((value) => results.push(value))

      source.set(1)
      fallback.set('new value')

      expect(results).toEqual(['fallback', 'new value'])

      unsub()
    })

    it('should properly cleanup subscriptions', () => {
      const source = reactive(0)
      const fallback = reactive('fallback')
      
      const errorSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            throw new Error('Error')
          })
        }
      }

      const catchStream = catchError(errorSource, (error) => fallback)
      const results: (number | string)[] = []

      const unsub = catchStream.subscribe((value) => results.push(value))

      source.set(1) // Triggers error and fallback
      unsub() // Should cleanup both source and fallback

      fallback.set('after unsubscribe')
      expect(results).toEqual(['fallback']) // Should not include 'after unsubscribe'

      unsub() // Should not throw
    })
  })

  describe('startWith', () => {
    it('should emit initial value immediately', () => {
      const source = reactive(0)
      const startStream = startWith(source, 'initial')
      const results: (string | number)[] = []

      const unsub = startStream.subscribe((value) => results.push(value))

      expect(results).toEqual(['initial'])

      source.set(1)
      source.set(2)

      expect(results).toEqual(['initial', 1, 2])

      unsub()
    })

    it('should handle multiple subscribers', () => {
      const source = reactive(0)
      const startStream = startWith(source, 'initial')
      const results1: (string | number)[] = []
      const results2: (string | number)[] = []

      const unsub1 = startStream.subscribe((value) => results1.push(value))
      const unsub2 = startStream.subscribe((value) => results2.push(value))

      expect(results1).toEqual(['initial'])
      expect(results2).toEqual(['initial'])

      source.set(1)

      expect(results1).toEqual(['initial', 1])
      expect(results2).toEqual(['initial', 1])

      unsub1()
      unsub2()
    })

    it('should handle null/undefined initial values', () => {
      const source = reactive(0)
      const startStream = startWith(source, null)
      const results: any[] = []

      const unsub = startStream.subscribe((value) => results.push(value))

      expect(results).toEqual([null])

      source.set(1)
      expect(results).toEqual([null, 1])

      unsub()
    })
  })

  describe('scan', () => {
    it('should accumulate values with reducer function', () => {
      const source = reactive(0)
      const scanStream = scan(source, (acc: number, val: number) => acc + val, 0)
      const results: number[] = []

      const unsub = scanStream.subscribe((value) => results.push(value))

      expect(results).toEqual([0]) // Initial seed

      source.set(1)
      source.set(2)
      source.set(3)

      expect(results).toEqual([0, 1, 3, 6]) // 0, 0+1, 1+2, 3+3

      unsub()
    })

    it('should handle different types with reducer', () => {
      const source = reactive('a')
      const scanStream = scan(source, (acc: string, val: string) => acc + val, '')
      const results: string[] = []

      const unsub = scanStream.subscribe((value) => results.push(value))

      expect(results).toEqual([''])

      source.set('b')
      source.set('c')

      expect(results).toEqual(['', 'b', 'bc'])

      unsub()
    })

    it('should handle complex objects', () => {
      const source = reactive({ id: 1 })
      const scanStream = scan(source, (acc: any[], val: any) => [...acc, val], [])
      const results: any[][] = []

      const unsub = scanStream.subscribe((value) => results.push(value))

      expect(results).toEqual([[]])

      source.set({ id: 2 })
      source.set({ id: 3 })

      expect(results).toEqual([[], [{ id: 2 }], [{ id: 2 }, { id: 3 }]])

      unsub()
    })
  })

  describe('combineLatest edge cases', () => {
    it('should not emit until both sources have emitted', () => {
      const sourceA = reactive(0)
      const sourceB = reactive(0)
      const combined = combineLatest(sourceA, sourceB)
      const results: [number, number][] = []

      const unsub = combined.subscribe((value) => results.push(value))

      expect(results).toEqual([]) // No emission yet

      sourceA.set(1)
      expect(results).toEqual([]) // Still no emission

      sourceB.set(2)
      expect(results).toEqual([[1, 2]]) // Now emits

      unsub()
    })

    it('should emit on every change after both have emitted', () => {
      const sourceA = reactive(0)
      const sourceB = reactive(0)
      const combined = combineLatest(sourceA, sourceB)
      const results: [number, number][] = []

      const unsub = combined.subscribe((value) => results.push(value))

      sourceA.set(1)
      sourceB.set(2)
      sourceA.set(3)
      sourceB.set(4)

      expect(results).toEqual([[1, 2], [3, 2], [3, 4]])

      unsub()
    })

    it('should handle one source never emitting', () => {
      const sourceA = reactive(0)
      const sourceB = reactive(0)
      const combined = combineLatest(sourceA, sourceB)
      const results: [number, number][] = []

      const unsub = combined.subscribe((value) => results.push(value))

      sourceA.set(1)
      sourceA.set(2)
      sourceA.set(3)

      expect(results).toEqual([]) // No emissions because B never emitted

      unsub()
    })
  })

  describe('withLatestFrom edge cases', () => {
    it('should not emit until other source has emitted', () => {
      const source = reactive(0)
      const other = reactive(0)
      const withLatest = withLatestFrom(source, other)
      const results: [number, number][] = []

      const unsub = withLatest.subscribe((value) => results.push(value))

      source.set(1)
      source.set(2)
      expect(results).toEqual([]) // No emissions yet

      other.set(10)
      source.set(3)
      expect(results).toEqual([[3, 10]]) // Now emits

      unsub()
    })

    it('should only emit on source changes, not other changes', () => {
      const source = reactive(0)
      const other = reactive(0)
      const withLatest = withLatestFrom(source, other)
      const results: [number, number][] = []

      const unsub = withLatest.subscribe((value) => results.push(value))

      other.set(10)
      source.set(1)
      other.set(20) // Should not emit
      source.set(2) // Should emit with latest other value

      expect(results).toEqual([[1, 10], [2, 20]])

      unsub()
    })
  })

  describe('switchMap edge cases', () => {
    it('should cancel previous inner subscription when outer emits', () => {
      const outer = reactive(0)
      const inner1 = reactive('inner1')
      const inner2 = reactive('inner2')
      
      let inner1Unsubscribed = false
      let inner2Unsubscribed = false

      const project = (value: number) => {
        if (value === 1) {
          return {
            ...inner1,
            subscribe(callback: (val: string) => void) {
              const unsub = inner1.subscribe(callback)
              return () => {
                inner1Unsubscribed = true
                unsub()
              }
            }
          }
        } else {
          return {
            ...inner2,
            subscribe(callback: (val: string) => void) {
              const unsub = inner2.subscribe(callback)
              return () => {
                inner2Unsubscribed = true
                unsub()
              }
            }
          }
        }
      }

      const switchStream = switchMap(outer, project)
      const results: string[] = []

      const unsub = switchStream.subscribe((value) => results.push(value))

      outer.set(1)
      inner1.set('value1')
      outer.set(2) // Should cancel inner1
      inner2.set('value2')

      expect(inner1Unsubscribed).toBe(true)
      expect(results).toEqual(['value1', 'value2'])

      unsub()
    })

    it('should handle outer completion before inner completion', () => {
      const outer = reactive(0)
      const inner = reactive('inner')
      
      let innerCompleted = false
      const project = (value: number) => {
        return {
          ...inner,
          subscribe(callback: (val: string) => void) {
            const unsub = inner.subscribe(callback)
            return () => {
              innerCompleted = true
              unsub()
            }
          }
        }
      }

      const switchStream = switchMap(outer, project)
      const results: string[] = []

      const unsub = switchStream.subscribe((value) => results.push(value))

      outer.set(1)
      inner.set('value1')
      unsub() // Outer unsubscribes

      expect(innerCompleted).toBe(true)
      expect(results).toEqual(['value1'])

      unsub() // Should not throw
    })

    it('should handle rapid outer emissions', () => {
      const outer = reactive(0)
      const inner = reactive('inner')
      
      let subscriptionCount = 0
      const project = (value: number) => {
        subscriptionCount++
        return inner
      }

      const switchStream = switchMap(outer, project)
      const results: string[] = []

      const unsub = switchStream.subscribe((value) => results.push(value))

      // Rapid emissions
      outer.set(1)
      outer.set(2)
      outer.set(3)
      inner.set('final')

      expect(subscriptionCount).toBe(3)
      expect(results).toEqual(['final']) // Only latest inner value

      unsub()
    })
  })
}) 