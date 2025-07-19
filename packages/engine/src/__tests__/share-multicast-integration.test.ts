import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from '../reactive'
import { share } from '../share'
import { multicast } from '../multicast'

describe('share() and multicast() integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeObservable() {
    const calls: number[] = []
    const source = reactive(0)
    
    const obs = {
      ...source,
      subscribe(callback: (value: number) => void) {
        const unsub = source.subscribe((v) => {
          calls.push(v)
          callback(v)
        })
        return unsub
      }
    }
    
    return { obs, calls, source }
  }

  describe('share()', () => {
    it('should multicast values to multiple subscribers', async () => {
      const { obs, calls, source } = makeObservable()
      const shared = share(obs)

      const results1: number[] = []
      const results2: number[] = []

      const unsub1 = shared.subscribe(val => results1.push(val))
      const unsub2 = shared.subscribe(val => results2.push(val))

      source.set(1)
      source.set(2)
      source.set(3)

      expect(results1).toEqual([1, 2, 3])
      expect(results2).toEqual([1, 2, 3])
      expect(calls).toEqual([1, 2, 3])

      unsub1()
      unsub2()
    })

    it('should unsubscribe from source when all subscribers unsubscribe', async () => {
      let unsubCount = 0
      const source = reactive(0)
      
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          const id = setInterval(() => {
            const val = Math.random()
            source.set(val)
            callback(val)
          }, 100)
          
          return () => {
            unsubCount++
            clearInterval(id)
          }
        }
      }

      const shared = share(trackedSource)
      const sub1 = shared.subscribe(() => {})
      const sub2 = shared.subscribe(() => {})

      sub1()
      expect(unsubCount).toBe(0)
      sub2()
      expect(unsubCount).toBe(1)
    })

    it('should auto-connect on first subscription', () => {
      const { obs, calls, source } = makeObservable()
      const shared = share(obs)

      // No emissions before subscription
      source.set(1)
      expect(calls).toEqual([])

      // Auto-connect on first subscription
      const unsub = shared.subscribe(() => {})
      source.set(2)
      expect(calls).toEqual([2])

      unsub()
    })

    it('should auto-disconnect on last unsubscription', () => {
      const { obs, calls, source } = makeObservable()
      const shared = share(obs)

      const sub1 = shared.subscribe(() => {})
      const sub2 = shared.subscribe(() => {})

      source.set(1)
      expect(calls).toEqual([1])

      sub1() // Still connected
      source.set(2)
      expect(calls).toEqual([1, 2])

      sub2() // Now disconnected
      source.set(3)
      expect(calls).toEqual([1, 2]) // No more emissions
    })
  })

  describe('multicast()', () => {
    it('should allow manual control of connection', async () => {
      const { obs, calls, source } = makeObservable()
      const multicasted = multicast(obs)

      const results1: number[] = []
      const results2: number[] = []

      const unsub1 = multicasted.subscribe(val => results1.push(val))
      const unsub2 = multicasted.subscribe(val => results2.push(val))

      // No emissions before connect
      source.set(1)
      expect(results1).toEqual([])
      expect(results2).toEqual([])
      expect(calls).toEqual([])

      // Manual connect
      ;(multicasted as any).connect()
      source.set(2)
      source.set(3)

      expect(results1).toEqual([2, 3])
      expect(results2).toEqual([2, 3])
      expect(calls).toEqual([2, 3])

      unsub1()
      unsub2()
    })

    it('should not emit until connect() is called', async () => {
      const { obs, source } = makeObservable()
      const multicasted = multicast(obs)

      const values: number[] = []
      const unsub = multicasted.subscribe((v) => values.push(v))

      source.set(1)
      source.set(2)
      source.set(3)
      
      expect(values).toEqual([]) // No emissions without connect

      ;(multicasted as any).connect()
      source.set(4)
      source.set(5)

      expect(values).toEqual([4, 5]) // Only emissions after connect

      unsub()
    })

    it('should handle multiple connect calls safely', () => {
      const { obs, calls, source } = makeObservable()
      const multicasted = multicast(obs)

      const unsub = multicasted.subscribe(() => {})

      ;(multicasted as any).connect()
      ;(multicasted as any).connect() // Should not cause issues
      ;(multicasted as any).connect() // Should not cause issues

      source.set(1)
      expect(calls).toEqual([1])

      unsub()
    })

    it('should disconnect when all subscribers unsubscribe', () => {
      const { obs, calls, source } = makeObservable()
      const multicasted = multicast(obs)

      const sub1 = multicasted.subscribe(() => {})
      const sub2 = multicasted.subscribe(() => {})

      ;(multicasted as any).connect()
      source.set(1)
      expect(calls).toEqual([1])

      sub1() // Still connected
      source.set(2)
      expect(calls).toEqual([1, 2])

      sub2() // Now disconnected
      source.set(3)
      expect(calls).toEqual([1, 2]) // No more emissions
    })
  })

  describe('Behavior differences', () => {
    it('should show share auto-connects while multicast requires manual connect', () => {
      const { obs, calls, source } = makeObservable()
      
      const shared = share(obs)
      const multicasted = multicast(obs)

      // Share auto-connects
      const sharedUnsub = shared.subscribe(() => {})
      source.set(1)
      expect(calls).toEqual([1])

      // Multicast requires manual connect
      const multicastedUnsub = multicasted.subscribe(() => {})
      source.set(2)
      expect(calls).toEqual([1]) // No change

      ;(multicasted as any).connect()
      source.set(3)
      expect(calls).toEqual([1, 3])

      sharedUnsub()
      multicastedUnsub()
    })

    it('should show share is higher-level convenience over multicast', () => {
      const { obs, calls, source } = makeObservable()
      
      // share() provides automatic connection management
      const shared = share(obs)
      const sharedUnsub = shared.subscribe(() => {})
      source.set(1)
      expect(calls).toEqual([1])

      // multicast() provides manual control
      const multicasted = multicast(obs)
      const multicastedUnsub = multicasted.subscribe(() => {})
      source.set(2)
      expect(calls).toEqual([1]) // No change without connect

      ;(multicasted as any).connect()
      source.set(3)
      expect(calls).toEqual([1, 3])

      sharedUnsub()
      multicastedUnsub()
    })
  })

  describe('Edge cases', () => {
    it('should handle connect() with no subscribers', () => {
      const { obs, calls, source } = makeObservable()
      const multicasted = multicast(obs)

      // Connect with no subscribers should not cause issues
      ;(multicasted as any).connect()
      source.set(1)
      expect(calls).toEqual([]) // No subscribers to receive

      const unsub = multicasted.subscribe(() => {})
      source.set(2)
      expect(calls).toEqual([2]) // Now connected and has subscriber

      unsub()
    })

    it('should handle rapid subscribe/unsubscribe with connect', () => {
      const { obs, calls, source } = makeObservable()
      const multicasted = multicast(obs)

      for (let i = 0; i < 5; i++) {
        const unsub = multicasted.subscribe(() => {})
        ;(multicasted as any).connect()
        source.set(i)
        unsub()
      }

      expect(calls).toEqual([0, 1, 2, 3, 4])
    })

    it('should handle share with rapid subscribe/unsubscribe', () => {
      const { obs, calls, source } = makeObservable()
      const shared = share(obs)

      for (let i = 0; i < 5; i++) {
        const unsub = shared.subscribe(() => {})
        source.set(i)
        unsub()
      }

      expect(calls).toEqual([0, 1, 2, 3, 4])
    })
  })
}) 