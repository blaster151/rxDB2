import { describe, it, expect } from 'vitest'
import { reactive } from '../reactive'

describe('pairwise', () => {
  it('emits pairs of consecutive values', () => {
    const results: [number, number][] = []
    const source = reactive(0)
    const paired = pairwise(source)
    paired.subscribe((v) => results.push(v))
    
    source.set(1)
    source.set(2)
    source.set(3)
    
    expect(results).toEqual([[1, 2], [2, 3]])
  })

  it('handles single value', () => {
    const results: [number, number][] = []
    const source = reactive(0)
    const paired = pairwise(source)
    paired.subscribe((v) => results.push(v))
    
    source.set(1)
    
    expect(results).toEqual([])
  })

  it('handles empty source', () => {
    const results: [number, number][] = []
    const source = reactive(0)
    const paired = pairwise(source)
    paired.subscribe((v) => results.push(v))
    
    expect(results).toEqual([])
  })

  it('handles rapid value changes', () => {
    const results: [number, number][] = []
    const source = reactive(0)
    const paired = pairwise(source)
    paired.subscribe((v) => results.push(v))
    
    source.set(1)
    source.set(2)
    source.set(3)
    source.set(4)
    source.set(5)
    
    expect(results).toEqual([[1, 2], [2, 3], [3, 4], [4, 5]])
  })

  it('handles undefined values', () => {
    const results: [number | undefined, number | undefined][] = []
    const source = reactive<number | undefined>(0)
    const paired = pairwise(source)
    paired.subscribe((v) => results.push(v))
    
    source.set(undefined)
    source.set(1)
    
    expect(results).toEqual([[undefined, 1]])
  })

  it('handles null values', () => {
    const results: [number | null, number | null][] = []
    const source = reactive<number | null>(0)
    const paired = pairwise(source)
    paired.subscribe((v) => results.push(v))
    
    source.set(null)
    source.set(1)
    
    expect(results).toEqual([[null, 1]])
  })

  it('handles object references', () => {
    const results: [any, any][] = []
    const source = reactive({ id: 0 })
    const paired = pairwise(source)
    paired.subscribe((v) => results.push(v))
    
    const obj1 = { id: 1 }
    const obj2 = { id: 2 }
    
    source.set(obj1)
    source.set(obj2)
    
    expect(results).toEqual([[obj1, obj2]])
  })

  it('maintains proper typing', () => {
    const source = reactive(0)
    const paired = pairwise(source)
    
    // This should compile without type errors
    paired.subscribe((pair: [number, number]) => {
      expect(typeof pair[0]).toBe('number')
      expect(typeof pair[1]).toBe('number')
    })
    
    source.set(1)
    source.set(2)
  })
}) 