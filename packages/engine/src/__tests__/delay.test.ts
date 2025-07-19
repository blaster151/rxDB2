import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from '../reactive'

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('delays emission by specified time', async () => {
    const results: number[] = []
    const source = reactive(0)
    const delayed = delay(source, 100)
    delayed.subscribe((v) => results.push(v))
    
    source.set(1)
    expect(results).toEqual([])
    
    vi.advanceTimersByTime(100)
    expect(results).toEqual([1])
  })

  it('handles multiple delayed values', () => {
    const results: number[] = []
    const source = reactive(0)
    const delayed = delay(source, 50)
    delayed.subscribe((v) => results.push(v))
    
    source.set(1)
    source.set(2)
    source.set(3)
    
    expect(results).toEqual([])
    
    vi.advanceTimersByTime(50)
    expect(results).toEqual([1, 2, 3])
  })

  it('handles zero delay', () => {
    const results: number[] = []
    const source = reactive(0)
    const delayed = delay(source, 0)
    delayed.subscribe((v) => results.push(v))
    
    source.set(1)
    expect(results).toEqual([1])
  })

  it('maintains value order', () => {
    const results: number[] = []
    const source = reactive(0)
    const delayed = delay(source, 100)
    delayed.subscribe((v) => results.push(v))
    
    source.set(1)
    source.set(2)
    source.set(3)
    
    vi.advanceTimersByTime(100)
    expect(results).toEqual([1, 2, 3])
  })

  it('handles subscription cleanup during delay', () => {
    const results: number[] = []
    const source = reactive(0)
    const delayed = delay(source, 100)
    
    const unsubscribe = delayed.subscribe((v) => results.push(v))
    
    source.set(1)
    unsubscribe()
    
    vi.advanceTimersByTime(100)
    expect(results).toEqual([])
  })

  it('handles very long delays', () => {
    const results: number[] = []
    const source = reactive(0)
    const delayed = delay(source, 10000)
    delayed.subscribe((v) => results.push(v))
    
    source.set(1)
    expect(results).toEqual([])
    
    vi.advanceTimersByTime(10000)
    expect(results).toEqual([1])
  })
}) 