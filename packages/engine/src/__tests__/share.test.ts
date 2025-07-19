import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from '../reactive'
import { share } from '../share'

describe('share operator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic sharing behavior', () => {
    it('should share a single subscription among multiple observers', () => {
      let subscriptionCount = 0
      const source = reactive(0)
      
      // Create a source that tracks subscriptions
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          subscriptionCount++
          const unsub = source.subscribe(callback)
          return () => {
            subscriptionCount--
            unsub()
          }
        }
      }

      const shared = share(trackedSource)
      
      const results1: number[] = []
      const results2: number[] = []
      const results3: number[] = []

      const unsub1 = shared.subscribe(val => results1.push(val))
      const unsub2 = shared.subscribe(val => results2.push(val))
      const unsub3 = shared.subscribe(val => results3.push(val))

      expect(subscriptionCount).toBe(1) // Only one subscription to source

      source.set(1)
      source.set(2)
      source.set(3)

      expect(results1).toEqual([1, 2, 3])
      expect(results2).toEqual([1, 2, 3])
      expect(results3).toEqual([1, 2, 3])

      unsub1()
      unsub2()
      unsub3()

      expect(subscriptionCount).toBe(0) // All subscriptions cleaned up
    })

    it('should emit initial value to all subscribers', () => {
      const source = reactive(42)
      const shared = share(source)
      
      const results1: number[] = []
      const results2: number[] = []

      const unsub1 = shared.subscribe(val => results1.push(val))
      const unsub2 = shared.subscribe(val => results2.push(val))

      expect(results1).toEqual([42])
      expect(results2).toEqual([42])

      unsub1()
      unsub2()
    })

    it('should handle different types', () => {
      const source = reactive('hello')
      const shared = share(source)
      
      const results1: string[] = []
      const results2: string[] = []

      const unsub1 = shared.subscribe(val => results1.push(val))
      const unsub2 = shared.subscribe(val => results2.push(val))

      source.set('world')
      source.set('test')

      expect(results1).toEqual(['hello', 'world', 'test'])
      expect(results2).toEqual(['hello', 'world', 'test'])

      unsub1()
      unsub2()
    })
  })

  describe('Reference counting', () => {
    it('should maintain source subscription until last observer unsubscribes', () => {
      let subscriptionCount = 0
      const source = reactive(0)
      
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          subscriptionCount++
          const unsub = source.subscribe(callback)
          return () => {
            subscriptionCount--
            unsub()
          }
        }
      }

      const shared = share(trackedSource)
      
      const unsub1 = shared.subscribe(() => {})
      const unsub2 = shared.subscribe(() => {})
      const unsub3 = shared.subscribe(() => {})

      expect(subscriptionCount).toBe(1) // One shared subscription

      unsub1() // First unsubscribe
      expect(subscriptionCount).toBe(1) // Still subscribed

      unsub2() // Second unsubscribe
      expect(subscriptionCount).toBe(1) // Still subscribed

      unsub3() // Last unsubscribe
      expect(subscriptionCount).toBe(0) // Now unsubscribed
    })

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      let subscriptionCount = 0
      const source = reactive(0)
      
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          subscriptionCount++
          const unsub = source.subscribe(callback)
          return () => {
            subscriptionCount--
            unsub()
          }
        }
      }

      const shared = share(trackedSource)
      
      for (let i = 0; i < 10; i++) {
        const unsub = shared.subscribe(() => {})
        source.set(i)
        unsub()
      }

      expect(subscriptionCount).toBe(0) // All subscriptions cleaned up
    })

    it('should handle multiple subscribers with different lifetimes', () => {
      let subscriptionCount = 0
      const source = reactive(0)
      
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          subscriptionCount++
          const unsub = source.subscribe(callback)
          return () => {
            subscriptionCount--
            unsub()
          }
        }
      }

      const shared = share(trackedSource)
      
      const unsub1 = shared.subscribe(() => {})
      const unsub2 = shared.subscribe(() => {})
      
      source.set(1)
      
      unsub1() // First subscriber unsubscribes
      source.set(2)
      
      const unsub3 = shared.subscribe(() => {}) // New subscriber joins
      source.set(3)
      
      unsub2() // Second subscriber unsubscribes
      unsub3() // Third subscriber unsubscribes
      
      expect(subscriptionCount).toBe(0)
    })
  })

  describe('Multicast semantics', () => {
    it('should multicast values to all active subscribers', () => {
      const source = reactive(0)
      const shared = share(source)
      
      const results1: number[] = []
      const results2: number[] = []
      const results3: number[] = []

      const unsub1 = shared.subscribe(val => results1.push(val))
      
      source.set(1)
      
      const unsub2 = shared.subscribe(val => results2.push(val))
      
      source.set(2)
      
      const unsub3 = shared.subscribe(val => results3.push(val))
      
      source.set(3)
      
      unsub1()
      source.set(4)
      
      unsub2()
      source.set(5)
      
      unsub3()
      
      expect(results1).toEqual([1, 2, 3]) // Got values while subscribed
      expect(results2).toEqual([2, 3, 4]) // Got values from subscription point
      expect(results3).toEqual([3, 5]) // Got values from subscription point
    })

    it('should handle late subscribers correctly', () => {
      const source = reactive(0)
      const shared = share(source)
      
      source.set(1)
      source.set(2)
      
      const results: number[] = []
      const unsub = shared.subscribe(val => results.push(val))
      
      source.set(3)
      source.set(4)
      
      unsub()
      
      expect(results).toEqual([2, 3, 4]) // Gets current value + future values
    })

    it('should handle early unsubscribes correctly', () => {
      const source = reactive(0)
      const shared = share(source)
      
      const results1: number[] = []
      const results2: number[] = []

      const unsub1 = shared.subscribe(val => results1.push(val))
      const unsub2 = shared.subscribe(val => results2.push(val))
      
      source.set(1)
      unsub1() // Early unsubscribe
      source.set(2)
      source.set(3)
      unsub2()
      
      expect(results1).toEqual([1]) // Only got value while subscribed
      expect(results2).toEqual([1, 2, 3]) // Got all values
    })
  })

  describe('Edge cases', () => {
    it('should handle unsubscribe during emission', () => {
      const source = reactive(0)
      const shared = share(source)
      
      const results: number[] = []
      let unsub: (() => void) | null = null
      
      unsub = shared.subscribe(val => {
        results.push(val)
        if (val === 1 && unsub) {
          unsub() // Unsubscribe during emission
        }
      })
      
      source.set(1)
      source.set(2) // Should not be received
      
      expect(results).toEqual([1])
    })

    it('should handle multiple unsubscribes safely', () => {
      const source = reactive(0)
      const shared = share(source)
      
      const unsub = shared.subscribe(() => {})
      
      unsub()
      unsub() // Should not throw
      unsub() // Should not throw
      
      source.set(1) // Should not cause issues
    })

    it('should handle empty observer set', () => {
      const source = reactive(0)
      const shared = share(source)
      
      // Don't subscribe, just emit
      source.set(1)
      source.set(2)
      
      // Should not throw
      expect(true).toBe(true)
    })

    it('should handle observers that throw', () => {
      const source = reactive(0)
      const shared = share(source)
      
      const results: number[] = []
      
      shared.subscribe(val => {
        if (val === 1) {
          throw new Error('Observer error')
        }
        results.push(val)
      })
      
      shared.subscribe(val => results.push(val))
      
      source.set(1) // First observer throws
      source.set(2) // Second observer should still receive
      
      expect(results).toEqual([2]) // Only second observer's result
    })

    it('should handle rapid emissions', () => {
      const source = reactive(0)
      const shared = share(source)
      
      const results: number[] = []
      const unsub = shared.subscribe(val => results.push(val))
      
      // Rapid emissions
      for (let i = 1; i <= 100; i++) {
        source.set(i)
      }
      
      unsub()
      
      expect(results.length).toBe(100)
      expect(results[0]).toBe(1)
      expect(results[99]).toBe(100)
    })
  })

  describe('Memory management', () => {
    it('should not leak observers after unsubscribe', () => {
      const source = reactive(0)
      const shared = share(source)
      
      // Access the internal observers set for testing
      const observers = (shared as any).observers || new Set()
      
      const unsub1 = shared.subscribe(() => {})
      const unsub2 = shared.subscribe(() => {})
      
      expect(observers.size).toBe(2)
      
      unsub1()
      expect(observers.size).toBe(1)
      
      unsub2()
      expect(observers.size).toBe(0)
    })

    it('should cleanup shared subscription when refCount reaches zero', () => {
      let subscriptionCount = 0
      const source = reactive(0)
      
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          subscriptionCount++
          const unsub = source.subscribe(callback)
          return () => {
            subscriptionCount--
            unsub()
          }
        }
      }

      const shared = share(trackedSource)
      
      const unsub1 = shared.subscribe(() => {})
      const unsub2 = shared.subscribe(() => {})
      
      expect(subscriptionCount).toBe(1)
      
      unsub1()
      unsub2()
      
      expect(subscriptionCount).toBe(0)
      
      // Resubscribe should create new subscription
      const unsub3 = shared.subscribe(() => {})
      expect(subscriptionCount).toBe(1)
      
      unsub3()
      expect(subscriptionCount).toBe(0)
    })
  })

  describe('Integration with other operators', () => {
    it('should work with map operator', () => {
      const source = reactive(0)
      const shared = share(source)
      const mapped = shared.map(x => x * 2)
      
      const results1: number[] = []
      const results2: number[] = []
      
      const unsub1 = mapped.subscribe(val => results1.push(val))
      const unsub2 = mapped.subscribe(val => results2.push(val))
      
      source.set(1)
      source.set(2)
      
      unsub1()
      unsub2()
      
      expect(results1).toEqual([2, 4])
      expect(results2).toEqual([2, 4])
    })

    it('should work with filter operator', () => {
      const source = reactive(0)
      const shared = share(source)
      const filtered = shared.filter(x => x > 0)
      
      const results1: number[] = []
      const results2: number[] = []
      
      const unsub1 = filtered.subscribe(val => results1.push(val))
      const unsub2 = filtered.subscribe(val => results2.push(val))
      
      source.set(0)
      source.set(1)
      source.set(0)
      source.set(2)
      
      unsub1()
      unsub2()
      
      expect(results1).toEqual([1, 2])
      expect(results2).toEqual([1, 2])
    })

    it('should work with chained operators', () => {
      const source = reactive(0)
      const shared = share(source)
      const chained = shared
        .map(x => x * 2)
        .filter(x => x > 0)
        .map(x => x + 1)
      
      const results1: number[] = []
      const results2: number[] = []
      
      const unsub1 = chained.subscribe(val => results1.push(val))
      const unsub2 = chained.subscribe(val => results2.push(val))
      
      source.set(0)
      source.set(1)
      source.set(2)
      
      unsub1()
      unsub2()
      
      expect(results1).toEqual([3, 5]) // (1*2+1), (2*2+1)
      expect(results2).toEqual([3, 5])
    })
  })
}) 