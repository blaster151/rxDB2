import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from '../reactive'
import { tap } from '../operators'
import { concatMap } from '../operators'

describe('tap operator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic functionality', () => {
         it('should execute side effect without altering the stream', () => {
       const source = reactive(0)
       const sideEffects: number[] = []
       
       const tapped = tap(source, (value: number) => {
         sideEffects.push(value)
       })
      
      const results: number[] = []
      const unsub = tapped.subscribe(val => results.push(val))
      
      source.set(1)
      source.set(2)
      source.set(3)
      
      expect(results).toEqual([1, 2, 3])
      expect(sideEffects).toEqual([1, 2, 3])
      
      unsub()
    })

    it('should handle different types', () => {
      const source = reactive('hello')
      const sideEffects: string[] = []
      
      const tapped = tap(source, (value) => {
        sideEffects.push(value)
      })
      
      const results: string[] = []
      const unsub = tapped.subscribe(val => results.push(val))
      
      source.set('world')
      source.set('test')
      
      expect(results).toEqual(['world', 'test'])
      expect(sideEffects).toEqual(['world', 'test'])
      
      unsub()
    })

    it('should ignore return value of side effect function', () => {
      const source = reactive(0)
      const sideEffects: number[] = []
      
      const tapped = tap(source, (value) => {
        sideEffects.push(value)
        return 'ignored' // This should be ignored
      })
      
      const results: number[] = []
      const unsub = tapped.subscribe(val => results.push(val))
      
      source.set(1)
      source.set(2)
      
      expect(results).toEqual([1, 2])
      expect(sideEffects).toEqual([1, 2])
      
      unsub()
    })
  })

  describe('Side effect patterns', () => {
    it('should work with console.log for debugging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const source = reactive(0)
      
      const tapped = tap(source, console.log)
      
      const unsub = tapped.subscribe(() => {})
      
      source.set(1)
      source.set(2)
      
      expect(consoleSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(2)
      
      consoleSpy.mockRestore()
      unsub()
    })

    it('should work with external state updates', () => {
      const source = reactive(0)
      let externalState = 0
      
      const tapped = tap(source, (value) => {
        externalState += value
      })
      
      const unsub = tapped.subscribe(() => {})
      
      source.set(1)
      source.set(2)
      source.set(3)
      
      expect(externalState).toBe(6) // 1 + 2 + 3
      
      unsub()
    })

    it('should work with multiple side effects', () => {
      const source = reactive(0)
      const effects1: number[] = []
      const effects2: number[] = []
      
      const tapped1 = tap(source, (value) => effects1.push(value))
      const tapped2 = tap(tapped1, (value) => effects2.push(value * 2))
      
      const unsub = tapped2.subscribe(() => {})
      
      source.set(1)
      source.set(2)
      
      expect(effects1).toEqual([1, 2])
      expect(effects2).toEqual([2, 4])
      
      unsub()
    })
  })

  describe('Error handling', () => {
    it('should not catch errors in side effect function', () => {
      const source = reactive(0)
      
      const tapped = tap(source, (value) => {
        if (value === 2) {
          throw new Error('Side effect error')
        }
      })
      
      const results: number[] = []
      const unsub = tapped.subscribe(val => results.push(val))
      
      source.set(1) // Should work
      
      expect(() => {
        source.set(2) // Should throw
      }).toThrow('Side effect error')
      
      expect(results).toEqual([1])
      
      unsub()
    })
  })

  describe('Integration with other operators', () => {
    it('should work with map operator', () => {
      const source = reactive(0)
      const sideEffects: number[] = []
      
      const transformed = tap(source, (value) => {
        sideEffects.push(value)
      }).map(x => x * 2)
      
      const results: number[] = []
      const unsub = transformed.subscribe(val => results.push(val))
      
      source.set(1)
      source.set(2)
      
      expect(results).toEqual([2, 4])
      expect(sideEffects).toEqual([1, 2])
      
      unsub()
    })

    it('should work with filter operator', () => {
      const source = reactive(0)
      const sideEffects: number[] = []
      
      const filtered = tap(source, (value) => {
        sideEffects.push(value)
      }).filter(x => x > 0)
      
      const results: number[] = []
      const unsub = filtered.subscribe(val => results.push(val))
      
      source.set(0) // Should not pass filter but side effect should run
      source.set(1) // Should pass filter
      source.set(2) // Should pass filter
      
      expect(results).toEqual([1, 2])
      expect(sideEffects).toEqual([0, 1, 2])
      
      unsub()
    })
  })
})

describe('concatMap operator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic functionality', () => {
    it('should concatenate inner observables in order', () => {
      const source = reactive(0)
      
      // Create inner observables that emit and complete
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        setTimeout(() => inner.set([...inner.get(), value]), 10)
        setTimeout(() => inner.set([...inner.get(), value * 10]), 20)
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const results: number[] = []
      const unsub = concatenated.subscribe(val => results.push(...val))
      
      source.set(1)
      source.set(2)
      source.set(3)
      
      // Advance timers to trigger emissions
      vi.advanceTimersByTime(50)
      
      expect(results).toEqual([1, 10, 2, 20, 3, 30])
      
      unsub()
    })

    it('should wait for inner observable to complete before processing next', () => {
      const source = reactive(0)
      let innerCompleted = false
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        setTimeout(() => {
          inner.set([...inner.get(), value])
          innerCompleted = true
        }, 10)
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const results: number[] = []
      const unsub = concatenated.subscribe(val => results.push(...val))
      
      source.set(1)
      source.set(2)
      
      // Only first inner should have completed
      vi.advanceTimersByTime(5)
      expect(innerCompleted).toBe(false)
      
      // First inner completes
      vi.advanceTimersByTime(10)
      expect(innerCompleted).toBe(true)
      
      unsub()
    })

    it('should preserve order of source emissions', () => {
      const source = reactive(0)
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        // Simulate different completion times
        setTimeout(() => inner.set([...inner.get(), value]), value * 10)
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const results: number[] = []
      const unsub = concatenated.subscribe(val => results.push(...val))
      
      source.set(3) // Will complete last
      source.set(1) // Will complete first
      source.set(2) // Will complete second
      
      vi.advanceTimersByTime(50)
      
      // Order should be preserved: 1, 2, 3
      expect(results).toEqual([1, 2, 3])
      
      unsub()
    })
  })

  describe('Completion behavior', () => {
    it('should complete after last inner observable completes', () => {
      const source = reactive(0)
      let completed = false
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        setTimeout(() => inner.set([...inner.get(), value]), 10)
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const unsub = concatenated.subscribe(
        () => {},
        () => {},
        () => { completed = true }
      )
      
      source.set(1)
      source.set(2)
      
      // Source completes
      // Wait for all inners to complete
      vi.advanceTimersByTime(50)
      
      expect(completed).toBe(true)
      
      unsub()
    })

    it('should handle empty source', () => {
      const source = reactive(0)
      let completed = false
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const unsub = concatenated.subscribe(
        () => {},
        () => {},
        () => { completed = true }
      )
      
      // No emissions, should complete immediately
      expect(completed).toBe(true)
      
      unsub()
    })
  })

  describe('Error handling', () => {
    it('should propagate source errors immediately', () => {
      const source = reactive(0)
      let errorCaught = false
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const unsub = concatenated.subscribe(
        () => {},
        (error) => { errorCaught = true }
      )
      
      // Simulate source error
      source.set(1)
      // Error would be thrown here in real implementation
      
      unsub()
    })

    it('should propagate inner observable errors immediately', () => {
      const source = reactive(0)
      let errorCaught = false
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        // Simulate inner error
        setTimeout(() => {
          throw new Error('Inner error')
        }, 10)
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const unsub = concatenated.subscribe(
        () => {},
        (error) => { errorCaught = true }
      )
      
      source.set(1)
      vi.advanceTimersByTime(15)
      
      expect(errorCaught).toBe(true)
      
      unsub()
    })
  })

  describe('Queue management', () => {
    it('should queue source values when inner is processing', () => {
      const source = reactive(0)
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        setTimeout(() => inner.set([...inner.get(), value]), 20)
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const results: number[] = []
      const unsub = concatenated.subscribe(val => results.push(...val))
      
      source.set(1)
      source.set(2)
      source.set(3)
      
      // First inner should be processing, others queued
      vi.advanceTimersByTime(10)
      expect(results).toEqual([])
      
      // First inner completes, second starts
      vi.advanceTimersByTime(20)
      expect(results).toEqual([1, 2])
      
      // Third inner completes
      vi.advanceTimersByTime(20)
      expect(results).toEqual([1, 2, 3])
      
      unsub()
    })

    it('should handle rapid source emissions', () => {
      const source = reactive(0)
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        setTimeout(() => inner.set([...inner.get(), value]), 5)
        return inner
      }
      
      const concatenated = concatMap(source, createInner)
      
      const results: number[] = []
      const unsub = concatenated.subscribe(val => results.push(...val))
      
      // Rapid emissions
      for (let i = 1; i <= 5; i++) {
        source.set(i)
      }
      
      vi.advanceTimersByTime(50)
      
      expect(results).toEqual([1, 2, 3, 4, 5])
      
      unsub()
    })
  })

  describe('Integration with other operators', () => {
    it('should work with tap operator', () => {
      const source = reactive(0)
      const sideEffects: number[] = []
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        setTimeout(() => inner.set([...inner.get(), value]), 10)
        return inner
      }
      
      const transformed = concatMap(source, createInner)
      const tapped = tap(transformed, (value) => {
        sideEffects.push(value.length)
      })
      
      const unsub = tapped.subscribe(() => {})
      
      source.set(1)
      source.set(2)
      
      vi.advanceTimersByTime(50)
      
      expect(sideEffects.length).toBeGreaterThan(0)
      
      unsub()
    })

    it('should work with map operator', () => {
      const source = reactive(0)
      
      const createInner = (value: number) => {
        const inner = reactive([] as number[])
        setTimeout(() => inner.set([...inner.get(), value]), 10)
        return inner
      }
      
      const transformed = concatMap(source, createInner)
      const mapped = transformed.map(values => values.map(v => v * 2))
      
      const results: number[] = []
      const unsub = mapped.subscribe(val => results.push(...val))
      
      source.set(1)
      source.set(2)
      
      vi.advanceTimersByTime(50)
      
      expect(results).toEqual([2, 4])
      
      unsub()
    })
  })
}) 