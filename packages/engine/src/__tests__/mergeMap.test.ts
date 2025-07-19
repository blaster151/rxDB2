import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from '../reactive'

describe('mergeMap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('emits values from all inner observables', () => {
    const results: number[] = []
    const source = reactive(0)
    const merged = mergeMap(source, (v) => {
      const r = reactive(v * 10)
      setTimeout(() => r.set(v * 10), 0)
      return r
    })
    merged.subscribe((v) => results.push(v))
    
    source.set(1)
    source.set(2)
    
    vi.advanceTimersByTime(10)
    expect(results).toEqual([10, 20])
  })

  it('maintains multiple concurrent subscriptions', () => {
    const results: number[] = []
    const source = reactive(0)
    const merged = mergeMap(source, (v) => reactive(v * 10))
    
    merged.subscribe((v) => results.push(v))
    
    source.set(1)
    source.set(2)
    
    expect(results).toEqual([10, 20])
  })

  it('handles empty inner observables', () => {
    const results: number[] = []
    const source = reactive(0)
    const merged = mergeMap(source, () => reactive(0))
    
    merged.subscribe((v) => results.push(v))
    
    source.set(1)
    expect(results).toEqual([0])
  })

  it('handles rapid source changes', () => {
    const results: number[] = []
    const source = reactive(0)
    const merged = mergeMap(source, (v) => reactive(v * 10))
    
    merged.subscribe((v) => results.push(v))
    
    source.set(1)
    source.set(2)
    source.set(3)
    
    expect(results).toEqual([10, 20, 30])
  })

  it('properly cleans up subscriptions', () => {
    const results: number[] = []
    const source = reactive(0)
    const merged = mergeMap(source, (v) => reactive(v * 10))
    
    const unsubscribe = merged.subscribe((v) => results.push(v))
    
    source.set(1)
    unsubscribe()
    source.set(2)
    
    expect(results).toEqual([10])
  })
}) 