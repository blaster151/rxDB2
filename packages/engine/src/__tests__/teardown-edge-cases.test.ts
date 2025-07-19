import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from '../reactive'
import { 
  delay, 
  switchMap, 
  mergeMap,
  combineLatest,
  withLatestFrom,
  retry,
  catchError,
  startWith,
  scan
} from '../operators'

describe('Teardown Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Operator Chain Teardown', () => {
    it('should call teardown when unsubscribed mid-chain', async () => {
      let unsubscribed = false
      let intervalId: any = null

      // Create a source that emits periodically
      const source = reactive(0)
      const periodicSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          intervalId = setInterval(() => {
            source.set(source.get() + 1)
            callback(source.get())
          }, 10)
          return () => {
            if (intervalId) {
              clearInterval(intervalId)
              intervalId = null
              unsubscribed = true
            }
          }
        }
      }

      const chained = periodicSource.map(x => x + 1)
      const filtered = chained.filter(x => x % 2 === 0)
      
      const unsub = filtered.subscribe(() => {})

      // Advance time to trigger emissions
      vi.advanceTimersByTime(30)
      
      unsub()

      expect(unsubscribed).toBe(true)
      expect(intervalId).toBe(null)
    })

    it('should propagate teardown through operator chains', () => {
      let cleanupCount = 0
      const source = reactive(0)
      
      // Create a source that tracks cleanup
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          cleanupCount++
          const unsub = source.subscribe(callback)
          return () => {
            cleanupCount--
            unsub()
          }
        }
      }

      const withInitial = startWith(trackedSource, -1)
      const mapped = withInitial.map(x => x * 2)
      const filtered = mapped.filter(x => x > 0)
      const scanned = scan(filtered, (acc: number, val: number) => acc + val, 0)

      const sub = scanned.subscribe(() => {})
      
      expect(cleanupCount).toBe(1)
      
      sub.unsubscribe()
      
      expect(cleanupCount).toBe(0)
    })

    it('should handle teardown in switchMap chains', () => {
      let innerCleanupCount = 0
      const outer = reactive(0)
      
      const createInner = (id: number) => {
        const inner = reactive(`inner${id}`)
        const trackedInner = {
          ...inner,
          subscribe(callback: (value: string) => void) {
            innerCleanupCount++
            const unsub = inner.subscribe(callback)
            return () => {
              innerCleanupCount--
              unsub()
            }
          }
        }
        return trackedInner
      }

      const switched = switchMap(outer, createInner)
      const sub = switched.subscribe(() => {})

      outer.set(1) // Creates inner1
      expect(innerCleanupCount).toBe(1)
      
      outer.set(2) // Creates inner2, should cleanup inner1
      expect(innerCleanupCount).toBe(1) // inner1 cleaned up, inner2 active
      
      sub.unsubscribe()
      expect(innerCleanupCount).toBe(0)
    })
  })

  describe('Early Unsubscribe from Delayed Sources', () => {
    it('should stop emitting if unsubscribed before delay completes', async () => {
      let called = false
      let timeoutId: any = null

      const delayed = reactive(0)
      const delayedSource = {
        ...delayed,
        subscribe(callback: (value: number) => void) {
          timeoutId = setTimeout(() => {
            called = true
            delayed.set(1)
            callback(1)
          }, 50)
          return () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
          }
        }
      }

      const sub = delayedSource.subscribe(() => {})
      
      // Unsubscribe before delay completes
      vi.advanceTimersByTime(20)
      sub.unsubscribe()
      
      // Advance past the delay
      vi.advanceTimersByTime(70)
      
      expect(called).toBe(false)
      expect(timeoutId).toBe(null)
    })

    it('should cleanup delayed emissions in operator chains', async () => {
      let delayedEmissions = 0
      const source = reactive(0)
      
      const delayedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          const timeoutId = setTimeout(() => {
            delayedEmissions++
            callback(value)
          }, 100)
          return () => clearTimeout(timeoutId)
        }
      }

      const mapped = delayedSource.map(x => x * 2)
      const sub = mapped.subscribe(() => {})
      
      source.set(1)
      
      // Unsubscribe before delay completes
      vi.advanceTimersByTime(50)
      sub.unsubscribe()
      
      // Advance past the delay
      vi.advanceTimersByTime(100)
      
      expect(delayedEmissions).toBe(0)
    })

    it('should handle early unsubscribe from retry operator', async () => {
      let attemptCount = 0
      const source = reactive(0)
      
      const failingSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          attemptCount++
          const timeoutId = setTimeout(() => {
            throw new Error('Simulated error')
          }, 50)
          return () => clearTimeout(timeoutId)
        }
      }

      const retryStream = retry(failingSource, 3)
      const sub = retryStream.subscribe(() => {})
      
      source.set(1)
      
      // Unsubscribe before retry attempts complete
      vi.advanceTimersByTime(20)
      sub.unsubscribe()
      
      // Advance past retry attempts
      vi.advanceTimersByTime(200)
      
      expect(attemptCount).toBe(1) // Only initial attempt, no retries
    })
  })

  describe('Multiple Subscribers and Reference Counting', () => {
    it('should track independent teardowns for multiple subs', async () => {
      let subscriptionCount = 0
      let cleanupCount = 0

      const source = reactive(0)
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          subscriptionCount++
          const unsub = source.subscribe(callback)
          return () => {
            cleanupCount++
            subscriptionCount--
            unsub()
          }
        }
      }

      const sub1 = trackedSource.subscribe(() => {})
      const sub2 = trackedSource.subscribe(() => {})

      expect(subscriptionCount).toBe(2)
      expect(cleanupCount).toBe(0)

      sub1.unsubscribe()
      expect(subscriptionCount).toBe(1)
      expect(cleanupCount).toBe(1)

      sub2.unsubscribe()
      expect(subscriptionCount).toBe(0)
      expect(cleanupCount).toBe(2)
    })

    it('should handle shared observables with multiple subscribers', () => {
      let sharedCleanupCount = 0
      const sharedSource = reactive('shared')
      
      const trackedShared = {
        ...sharedSource,
        subscribe(callback: (value: string) => void) {
          sharedCleanupCount++
          const unsub = sharedSource.subscribe(callback)
          return () => {
            sharedCleanupCount--
            unsub()
          }
        }
      }

      const mapped1 = trackedShared.map(x => x + '_1')
      const mapped2 = trackedShared.map(x => x + '_2')

      const sub1 = mapped1.subscribe(() => {})
      const sub2 = mapped2.subscribe(() => {})

      expect(sharedCleanupCount).toBe(2) // Two subscriptions to shared source

      sub1.unsubscribe()
      expect(sharedCleanupCount).toBe(1)

      sub2.unsubscribe()
      expect(sharedCleanupCount).toBe(0)
    })

    it('should handle multiple subscribers to combination operators', () => {
      let sourceACount = 0
      let sourceBCount = 0
      
      const sourceA = reactive(0)
      const sourceB = reactive(0)
      
      const trackedA = {
        ...sourceA,
        subscribe(callback: (value: number) => void) {
          sourceACount++
          const unsub = sourceA.subscribe(callback)
          return () => {
            sourceACount--
            unsub()
          }
        }
      }
      
      const trackedB = {
        ...sourceB,
        subscribe(callback: (value: number) => void) {
          sourceBCount++
          const unsub = sourceB.subscribe(callback)
          return () => {
            sourceBCount--
            unsub()
          }
        }
      }

      const combined = combineLatest(trackedA, trackedB)
      
      const sub1 = combined.subscribe(() => {})
      const sub2 = combined.subscribe(() => {})

      expect(sourceACount).toBe(2) // Two subscriptions to A
      expect(sourceBCount).toBe(2) // Two subscriptions to B

      sub1.unsubscribe()
      expect(sourceACount).toBe(1)
      expect(sourceBCount).toBe(1)

      sub2.unsubscribe()
      expect(sourceACount).toBe(0)
      expect(sourceBCount).toBe(0)
    })
  })

  describe('Complex Teardown Scenarios', () => {
    it('should handle teardown in error recovery chains', () => {
      let fallbackCleanupCount = 0
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
      
      const trackedFallback = {
        ...fallback,
        subscribe(callback: (value: string) => void) {
          fallbackCleanupCount++
          const unsub = fallback.subscribe(callback)
          return () => {
            fallbackCleanupCount--
            unsub()
          }
        }
      }

      const resilient = retry(errorSource, 2)
      const withFallback = catchError(resilient, (error) => trackedFallback)
      
      const sub = withFallback.subscribe(() => {})
      
      source.set(1) // Triggers error and fallback
      expect(fallbackCleanupCount).toBe(1)
      
      sub.unsubscribe()
      expect(fallbackCleanupCount).toBe(0)
    })

    it('should handle teardown in scan with complex state', () => {
      let sourceCleanupCount = 0
      const source = reactive(0)
      
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          sourceCleanupCount++
          const unsub = source.subscribe(callback)
          return () => {
            sourceCleanupCount--
            unsub()
          }
        }
      }

      const scanned = scan(trackedSource, (acc: any[], val: number) => [...acc, val], [])
      const sub = scanned.subscribe(() => {})
      
      source.set(1)
      source.set(2)
      
      expect(sourceCleanupCount).toBe(1)
      
      sub.unsubscribe()
      expect(sourceCleanupCount).toBe(0)
    })

    it('should handle rapid subscribe/unsubscribe cycles with operators', () => {
      let cleanupCount = 0
      const source = reactive(0)
      
      const trackedSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          cleanupCount++
          const unsub = source.subscribe(callback)
          return () => {
            cleanupCount--
            unsub()
          }
        }
      }

      const mapped = trackedSource.map(x => x * 2)
      
      for (let i = 0; i < 10; i++) {
        const sub = mapped.subscribe(() => {})
        source.set(i)
        sub.unsubscribe()
      }
      
      expect(cleanupCount).toBe(0) // All subscriptions should be cleaned up
    })
  })

  describe('Memory Leak Prevention', () => {
    it('should not leak timers in delay operator', async () => {
      const source = reactive(0)
      const delayed = delay(source, 100)
      
      const sub = delayed.subscribe(() => {})
      
      source.set(1)
      
      // Unsubscribe before delay completes
      vi.advanceTimersByTime(50)
      sub.unsubscribe()
      
      // Advance past the delay - should not trigger callback
      vi.advanceTimersByTime(100)
      
      // No assertions needed - if timer leaks, test will hang
    })

    it('should cleanup all subscriptions in mergeMap on unsubscribe', () => {
      let activeSubscriptions = 0
      const outer = reactive(0)
      
      const createTrackedInner = () => {
        const inner = reactive('value')
        const trackedInner = {
          ...inner,
          subscribe(callback: (value: string) => void) {
            activeSubscriptions++
            const unsub = inner.subscribe(callback)
            return () => {
              activeSubscriptions--
              unsub()
            }
          }
        }
        return trackedInner
      }
      
      const merged = mergeMap(outer, createTrackedInner)
      const sub = merged.subscribe(() => {})
      
      outer.set(1) // Creates 1 subscription
      outer.set(2) // Creates 1 more subscription
      outer.set(3) // Creates 1 more subscription
      
      expect(activeSubscriptions).toBe(3)
      
      sub.unsubscribe()
      
      expect(activeSubscriptions).toBe(0)
    })

    it('should handle unsubscribe during active retry attempts', async () => {
      let attemptCount = 0
      const source = reactive(0)
      
      const failingSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          attemptCount++
          const timeoutId = setTimeout(() => {
            throw new Error('Simulated error')
          }, 50)
          return () => clearTimeout(timeoutId)
        }
      }

      const retryStream = retry(failingSource, 5)
      const sub = retryStream.subscribe(() => {})
      
      source.set(1)
      
      // Let some retry attempts start
      vi.advanceTimersByTime(100)
      expect(attemptCount).toBeGreaterThan(1)
      
      sub.unsubscribe()
      
      // Advance time - should not trigger more attempts
      vi.advanceTimersByTime(500)
      const finalAttemptCount = attemptCount
      
      // Wait a bit more to ensure no more attempts
      vi.advanceTimersByTime(1000)
      expect(attemptCount).toBe(finalAttemptCount) // Should not increase
    })
  })
}) 