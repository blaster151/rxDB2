import { describe, it, expect, vi } from 'vitest'
import { createObservable } from '../createObservable'

describe('observable', () => {
  it('should initialize with a given value', () => {
    const count = createObservable(0)
    expect(count.get()).toBe(0)
  })

  it('should update value with set()', () => {
    const count = createObservable(0)
    count.set(5)
    expect(count.get()).toBe(5)
  })

  it('should notify subscribers on set()', () => {
    const count = createObservable(0)
    const mockFn = vi.fn()
    count.subscribe(mockFn)
    count.set(1)
    count.set(2)
    expect(mockFn).toHaveBeenCalledTimes(3) // initial + 2 updates
    expect(mockFn).toHaveBeenLastCalledWith(2)
  })

  it('should allow unsubscribing from updates', () => {
    const count = createObservable(0)
    const mockFn = vi.fn()
    const unsubscribe = count.subscribe(mockFn)
    count.set(1)
    unsubscribe()
    count.set(2)
    expect(mockFn).toHaveBeenCalledTimes(2) // initial + 1 update
    expect(mockFn).toHaveBeenCalledWith(1)
  })
}) 