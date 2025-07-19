import { describe, it, expect } from 'vitest'
import { reactive } from '../reactive'

describe('Reactive.prototype.distinct', () => {
  it('should emit initial value', () => {
    const a = reactive(1)
    const out = a.distinct()

    let result: number | undefined
    out.subscribe(val => result = val)

    expect(result).toBe(1)
  })

  it('should not emit duplicate values', () => {
    const a = reactive(1)
    const out = a.distinct()

    const results: number[] = []
    out.subscribe(val => results.push(val))

    a.set(1) // duplicate
    a.set(1) // duplicate
    a.set(2) // new
    a.set(2) // duplicate
    a.set(3) // new

    expect(results).toEqual([1, 2, 3])
  })

  it('should emit undefined only once if repeated', () => {
    const a = reactive(undefined)
    const out = a.distinct()

    const results: (undefined)[] = []
    out.subscribe(val => results.push(val))

    a.set(undefined)
    a.set(undefined)

    expect(results).toEqual([undefined])
  })

  // Additional edge cases
  it('should handle null values correctly', () => {
    const a = reactive(null)
    const out = a.distinct()

    const results: (null)[] = []
    out.subscribe(val => results.push(val))

    a.set(null)
    a.set(null)
    a.set(1)
    a.set(null)

    expect(results).toEqual([null, 1, null])
  })

  it('should work with object references', () => {
    const obj1 = { id: 1 }
    const obj2 = { id: 2 }
    const a = reactive(obj1)
    const out = a.distinct()

    const results: any[] = []
    out.subscribe(val => results.push(val))

    a.set(obj1) // same reference
    a.set(obj2) // different reference
    a.set(obj2) // same reference
    a.set({ id: 2 }) // different object with same content

    expect(results).toEqual([obj1, obj2, { id: 2 }])
  })

  it('should handle empty string and zero values', () => {
    const a = reactive('')
    const out = a.distinct()

    const results: string[] = []
    out.subscribe(val => results.push(val))

    a.set('')
    a.set('hello')
    a.set('')
    a.set('world')

    expect(results).toEqual(['', 'hello', '', 'world'])
  })

  it('should work with boolean values', () => {
    const a = reactive(true)
    const out = a.distinct()

    const results: boolean[] = []
    out.subscribe(val => results.push(val))

    a.set(true)
    a.set(false)
    a.set(false)
    a.set(true)

    expect(results).toEqual([true, false, true])
  })
}) 