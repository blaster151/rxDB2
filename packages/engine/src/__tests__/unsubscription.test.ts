import { describe, it, expect, vi } from 'vitest'
import { reactive } from '../reactive'
import { 
  switchMap, 
  mergeMap, 
  delay, 
  zip, 
  withLatestFrom, 
  sample, 
  pairwise,
  takeWhile 
} from '../operators'

describe('Unsubscription Behavior', () => {
  describe('Basic Reactive unsubscribe', () => {
    it('should stop emitting after unsubscribe', () => {
      const source = reactive(0)
      const results: number[] = []
      
      const unsubscribe = source.subscribe(val => results.push(val))
      
      source.set(1)
      expect(results).toEqual([0, 1])
      
      unsubscribe()
      source.set(2)
      expect(results).toEqual([0, 1]) // Should not include 2
    })

    it('should allow multiple unsubscribes safely', () => {
      const source = reactive(0)
      const results: number[] = []
      
      const unsubscribe = source.subscribe(val => results.push(val))
      
      source.set(1)
      unsubscribe()
      unsubscribe() // Should not throw
      unsubscribe() // Should not throw
      
      source.set(2)
      expect(results).toEqual([0, 1]) // Should not include 2
    })

    it('should cleanup map subscriptions when parent unsubscribes', () => {
      const source = reactive(0)
      const mapped = source.map(x => x * 2)
      const results: number[] = []
      
      const unsubscribe = mapped.subscribe(val => results.push(val))
      
      source.set(1)
      source.set(2)
      expect(results).toEqual([0, 2, 4])
      
      unsubscribe()
      source.set(3)
      expect(results).toEqual([0, 2, 4]) // Should not include 6
    })

    it('should cleanup filter subscriptions when parent unsubscribes', () => {
      const source = reactive(0)
      const filtered = source.filter(x => x > 0)
      const results: number[] = []
      
      const unsubscribe = filtered.subscribe(val => results.push(val))
      
      source.set(1)
      source.set(0)
      source.set(2)
      expect(results).toEqual([1, 2])
      
      unsubscribe()
      source.set(3)
      expect(results).toEqual([1, 2]) // Should not include 3
    })
  })

  describe('Operator unsubscription', () => {
    it('switchMap should unsubscribe from old inner streams', () => {
      const outer = reactive(0)
      const innerEmissions: string[] = []
      
      // Create inner observables that track emissions
      const createInner = (id: number) => {
        const inner = reactive(`A${id}`)
        inner.subscribe(val => innerEmissions.push(val))
        return inner
      }
      
      const switched = switchMap(outer, createInner)
      const results: string[] = []
      const unsubscribe = switched.subscribe(val => results.push(val))
      
      outer.set(1) // Creates inner1
      outer.set(2) // Creates inner2, should unsubscribe from inner1
      
      // Manually trigger inner1 after switch
      const inner1 = createInner(1)
      inner1.set('B1') // Should not appear in results
      
      expect(results).toEqual(['A1', 'A2'])
      expect(innerEmissions).toContain('A1')
      expect(innerEmissions).toContain('A2')
      
      unsubscribe()
    })

    it('mergeMap should unsubscribe from all inner streams when parent unsubscribes', () => {
      const outer = reactive(0)
      const innerEmissions: string[] = []
      
      const createInner = (id: number) => {
        const inner = reactive(`X${id}`)
        inner.subscribe(val => innerEmissions.push(val))
        return inner
      }
      
      const merged = mergeMap(outer, createInner)
      const results: string[] = []
      const unsubscribe = merged.subscribe(val => results.push(val))
      
      outer.set(1) // Creates inner1
      outer.set(2) // Creates inner2
      
      unsubscribe()
      
      // Manually trigger inner streams after unsubscribe
      const inner1 = createInner(1)
      const inner2 = createInner(2)
      inner1.set('Y1')
      inner2.set('Y2')
      
      expect(results).toEqual(['X1', 'X2'])
      // innerEmissions should not include Y1, Y2
    })

    it('zip should unsubscribe from both sources when result unsubscribes', () => {
      const a = reactive('a1')
      const b = reactive('b1')
      const aEmissions: string[] = []
      const bEmissions: string[] = []
      
      a.subscribe(val => aEmissions.push(val))
      b.subscribe(val => bEmissions.push(val))
      
      const zipped = zip(a, b)
      const results: [string, string][] = []
      const unsubscribe = zipped.subscribe(val => results.push(val))
      
      a.set('a2')
      b.set('b2')
      
      unsubscribe()
      
      // Manual emissions after unsubscribe
      a.set('a3')
      b.set('b3')
      
      expect(results).toEqual([['a1', 'b1'], ['a2', 'b2']])
      expect(aEmissions).toEqual(['a1', 'a2', 'a3']) // a3 should be emitted
      expect(bEmissions).toEqual(['b1', 'b2', 'b3']) // b3 should be emitted
    })

    it('withLatestFrom should unsubscribe from both sources', () => {
      const source = reactive('x')
      const other = reactive('1')
      const sourceEmissions: string[] = []
      const otherEmissions: string[] = []
      
      source.subscribe(val => sourceEmissions.push(val))
      other.subscribe(val => otherEmissions.push(val))
      
      const combined = withLatestFrom(source, other)
      const results: [string, string][] = []
      const unsubscribe = combined.subscribe(val => results.push(val))
      
      source.set('y')
      other.set('2')
      
      unsubscribe()
      
      // Manual emissions after unsubscribe
      source.set('z')
      other.set('3')
      
      expect(results).toEqual([['y', '2']])
      expect(sourceEmissions).toEqual(['x', 'y', 'z']) // z should be emitted
      expect(otherEmissions).toEqual(['1', '2', '3']) // 3 should be emitted
    })

    it('sample should unsubscribe from both source and notifier', () => {
      const source = reactive('S1')
      const notifier = reactive('tick1')
      const sourceEmissions: string[] = []
      const notifierEmissions: string[] = []
      
      source.subscribe(val => sourceEmissions.push(val))
      notifier.subscribe(val => notifierEmissions.push(val))
      
      const sampled = sample(source, notifier)
      const results: string[] = []
      const unsubscribe = sampled.subscribe(val => results.push(val))
      
      source.set('S2')
      notifier.set('tick2')
      
      unsubscribe()
      
      // Manual emissions after unsubscribe
      source.set('S3')
      notifier.set('tick3')
      
      expect(results).toEqual(['S2'])
      expect(sourceEmissions).toEqual(['S1', 'S2', 'S3']) // S3 should be emitted
      expect(notifierEmissions).toEqual(['tick1', 'tick2', 'tick3']) // tick3 should be emitted
    })

    it('pairwise should unsubscribe from source', () => {
      const source = reactive(0)
      const sourceEmissions: number[] = []
      
      source.subscribe(val => sourceEmissions.push(val))
      
      const paired = pairwise(source)
      const results: [number, number][] = []
      const unsubscribe = paired.subscribe(val => results.push(val))
      
      source.set(1)
      source.set(2)
      
      unsubscribe()
      
      // Manual emission after unsubscribe
      source.set(3)
      
      expect(results).toEqual([[1, 2]])
      expect(sourceEmissions).toEqual([0, 1, 2, 3]) // 3 should be emitted
    })

    it('delay should unsubscribe from source', () => {
      const source = reactive(0)
      const sourceEmissions: number[] = []
      
      source.subscribe(val => sourceEmissions.push(val))
      
      const delayed = delay(source, 10)
      const results: number[] = []
      const unsubscribe = delayed.subscribe(val => results.push(val))
      
      source.set(1)
      
      unsubscribe()
      
      // Manual emission after unsubscribe
      source.set(2)
      
      expect(sourceEmissions).toEqual([0, 1, 2]) // 2 should be emitted
    })
  })

  describe('Memory safety', () => {
    it('should not leak subscribers after unsubscribe', () => {
      const source = reactive(0)
      const subscribers = new Set()
      
      // Mock the subscribe method to track subscribers
      const originalSubscribe = source.subscribe
      source.subscribe = function(callback) {
        subscribers.add(callback)
        const unsubscribe = originalSubscribe.call(this, callback)
        return () => {
          subscribers.delete(callback)
          unsubscribe()
        }
      }
      
      const unsubscribe1 = source.subscribe(() => {})
      const unsubscribe2 = source.subscribe(() => {})
      
      expect(subscribers.size).toBe(2)
      
      unsubscribe1()
      expect(subscribers.size).toBe(1)
      
      unsubscribe2()
      expect(subscribers.size).toBe(0)
    })

    it('should cleanup chained subscriptions', () => {
      const source = reactive(0)
      const mapped = source.map(x => x * 2)
      const filtered = mapped.filter(x => x > 0)
      
      const results: number[] = []
      const unsubscribe = filtered.subscribe(val => results.push(val))
      
      source.set(1)
      source.set(0)
      source.set(2)
      
      unsubscribe()
      
      // Verify no more emissions
      source.set(3)
      expect(results).toEqual([2, 4]) // Should not include 6
    })

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const source = reactive(0)
      const results: number[] = []
      
      for (let i = 0; i < 10; i++) {
        const unsubscribe = source.subscribe(val => results.push(val))
        source.set(i)
        unsubscribe()
      }
      
      // Should only have the last emission
      expect(results).toEqual([9])
    })
  })

  describe('Operator-specific cleanup', () => {
    it('switchMap should cancel pending inner emissions', () => {
      const outer = reactive(0)
      
      const createDelayedInner = (id: number) => {
        const inner = reactive(`A${id}`)
        setTimeout(() => inner.set(`B${id}`), 50)
        return inner
      }
      
      const switched = switchMap(outer, createDelayedInner)
      const results: string[] = []
      const unsubscribe = switched.subscribe(val => results.push(val))
      
      outer.set(1)
      outer.set(2) // Should switch to inner2, canceling inner1's delayed emission
      
      unsubscribe()
      
      // Wait for any delayed emissions
      return new Promise(resolve => {
        setTimeout(() => {
          expect(results).toEqual(['A1', 'A2']) // Should not include B1 or B2
          resolve(undefined)
        }, 100)
      })
    })

    it('mergeMap should cleanup all active subscriptions', () => {
      const outer = reactive(0)
      let activeSubscriptions = 0
      
      const createTrackedInner = () => {
        const inner = reactive('value')
        activeSubscriptions++
        const originalSubscribe = inner.subscribe
        inner.subscribe = function(callback) {
          const unsubscribe = originalSubscribe.call(this, callback)
          return () => {
            activeSubscriptions--
            unsubscribe()
          }
        }
        return inner
      }
      
      const merged = mergeMap(outer, createTrackedInner)
      const results: string[] = []
      const unsubscribe = merged.subscribe(val => results.push(val))
      
      outer.set(1) // Creates 1 subscription
      outer.set(2) // Creates 1 more subscription
      
      expect(activeSubscriptions).toBe(2)
      
      unsubscribe()
      
      expect(activeSubscriptions).toBe(0)
    })
  })
}) 