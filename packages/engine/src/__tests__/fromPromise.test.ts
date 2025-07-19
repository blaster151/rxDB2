import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fromPromise, fromAsync, fromPromiseWithError } from '../fromPromise'

describe('fromPromise', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic functionality', () => {
    it('should emit resolved value from a Promise', () => {
      const promise = Promise.resolve('success')
      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      // Should not emit initial value
      expect(results).toEqual([])

      // Advance timers to resolve promise
      vi.runAllTimers()

      expect(results).toEqual(['success'])
      unsub()
    })

    it('should handle async function with fromAsync', () => {
      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'async result'
      }

      const stream = fromAsync(asyncFn)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      expect(results).toEqual([])

      // Advance timers to complete async function
      vi.advanceTimersByTime(100)

      expect(results).toEqual(['async result'])
      unsub()
    })

    it('should not emit initial value', () => {
      const promise = Promise.resolve('test')
      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        results.push(value || 'null')
      })

      // Should not emit initial value
      expect(results).toEqual([])

      vi.runAllTimers()
      unsub()
    })
  })

  describe('Error handling', () => {
    it('should log error when Promise rejects', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Promise rejected')
      const promise = Promise.reject(error)
      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      vi.runAllTimers()

      expect(consoleSpy).toHaveBeenCalledWith('Promise rejected:', error)
      expect(results).toEqual([]) // Should not emit any values on error

      consoleSpy.mockRestore()
      unsub()
    })

    it('should emit error with fromPromiseWithError', () => {
      const error = new Error('Test error')
      const promise = Promise.reject(error)
      const stream = fromPromiseWithError(promise)
      const results: (string | Error)[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      vi.runAllTimers()

      expect(results).toEqual([error])
      unsub()
    })

    it('should handle non-Error rejections with fromPromiseWithError', () => {
      const promise = Promise.reject('string error')
      const stream = fromPromiseWithError(promise)
      const results: (string | Error)[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      vi.runAllTimers()

      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(Error)
      expect((results[0] as Error).message).toBe('string error')
      unsub()
    })
  })

  describe('Teardown behavior', () => {
    it('should not emit value if unsubscribed before resolve', () => {
      let resolvePromise: (value: string) => void
      const promise = new Promise<string>(resolve => {
        resolvePromise = resolve
      })

      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      // Unsubscribe before promise resolves
      unsub()

      // Resolve the promise
      resolvePromise!('late value')

      expect(results).toEqual([]) // Should not emit after unsubscribe
    })

    it('should not emit error if unsubscribed before reject', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      let rejectPromise: (error: Error) => void
      const promise = new Promise<string>((_, reject) => {
        rejectPromise = reject
      })

      const stream = fromPromise(promise)
      const unsub = stream.subscribe(() => {})

      // Unsubscribe before promise rejects
      unsub()

      // Reject the promise
      rejectPromise!(new Error('late error'))

      expect(consoleSpy).not.toHaveBeenCalled() // Should not log error after unsubscribe

      consoleSpy.mockRestore()
    })

    it('should handle multiple unsubscribes safely', () => {
      const promise = Promise.resolve('test')
      const stream = fromPromise(promise)
      const unsub = stream.subscribe(() => {})

      unsub()
      unsub() // Should not throw
      unsub() // Should not throw
    })
  })

  describe('Async timing', () => {
    it('should handle delayed promises', () => {
      const promise = new Promise<string>(resolve => {
        setTimeout(() => resolve('delayed'), 1000)
      })

      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      expect(results).toEqual([])

      // Advance time to trigger resolve
      vi.advanceTimersByTime(1000)

      expect(results).toEqual(['delayed'])
      unsub()
    })

    it('should handle immediate resolution', () => {
      const promise = Promise.resolve('immediate')
      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      // Should emit immediately
      expect(results).toEqual(['immediate'])
      unsub()
    })

    it('should handle multiple subscribers', () => {
      const promise = Promise.resolve('shared')
      const stream = fromPromise(promise)
      const results1: string[] = []
      const results2: string[] = []

      const unsub1 = stream.subscribe(value => {
        if (value) results1.push(value)
      })

      const unsub2 = stream.subscribe(value => {
        if (value) results2.push(value)
      })

      vi.runAllTimers()

      expect(results1).toEqual(['shared'])
      expect(results2).toEqual(['shared'])

      unsub1()
      unsub2()
    })
  })

  describe('Edge cases', () => {
    it('should handle already resolved promises', () => {
      const promise = Promise.resolve('already resolved')
      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      expect(results).toEqual(['already resolved'])
      unsub()
    })

    it('should handle already rejected promises', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const promise = Promise.reject(new Error('already rejected'))
      const stream = fromPromise(promise)
      const results: string[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      expect(results).toEqual([])
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      unsub()
    })

    it('should handle null/undefined values', () => {
      const promise = Promise.resolve(null)
      const stream = fromPromise(promise)
      const results: any[] = []

      const unsub = stream.subscribe(value => {
        results.push(value)
      })

      vi.runAllTimers()

      expect(results).toEqual([null])
      unsub()
    })

    it('should handle complex objects', () => {
      const data = { id: 1, name: 'test', nested: { value: 'deep' } }
      const promise = Promise.resolve(data)
      const stream = fromPromise(promise)
      const results: any[] = []

      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      vi.runAllTimers()

      expect(results).toEqual([data])
      unsub()
    })
  })

  describe('Memory management', () => {
    it('should not leak memory with multiple subscriptions', () => {
      const promise = Promise.resolve('test')
      const stream = fromPromise(promise)

      // Create multiple subscriptions
      const unsubs = Array.from({ length: 10 }, () => 
        stream.subscribe(() => {})
      )

      // Unsubscribe all
      unsubs.forEach(unsub => unsub())

      // Should not throw or leak memory
      expect(() => {
        stream.subscribe(() => {})()
      }).not.toThrow()
    })

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const promise = Promise.resolve('test')
      const stream = fromPromise(promise)

      for (let i = 0; i < 100; i++) {
        const unsub = stream.subscribe(() => {})
        unsub()
      }

      // Should still work after rapid cycles
      const results: string[] = []
      const unsub = stream.subscribe(value => {
        if (value) results.push(value)
      })

      vi.runAllTimers()
      expect(results).toEqual(['test'])
      unsub()
    })
  })
}) 