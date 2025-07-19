import { describe, it, expect } from 'vitest'
import { reactive } from '../reactive'

describe('Reactive.reduce()', () => {
  it('should accumulate values over time', () => {
    const source = reactive(0)
    const sum = source.reduce((acc, val) => acc + val, 0)

    let result = 0
    const unsub = sum.subscribe(val => result = val)

    expect(result).toBe(0)

    source.set(5)
    expect(result).toBe(5)

    source.set(3)
    expect(result).toBe(8)

    unsub()
  })
})

describe('Reactive.distinct()', () => {
  it('should suppress duplicate consecutive values', () => {
    const source = reactive(1)
    const distinct = source.distinct()

    let values: number[] = []
    const unsub = distinct.subscribe(val => values.push(val))

    source.set(1)
    source.set(2)
    source.set(2)
    source.set(3)
    source.set(3)
    source.set(3)
    source.set(1)

    expect(values).toEqual([1, 2, 3, 1])

    unsub()
  })
}) 