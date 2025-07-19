import { describe, it, expect } from 'vitest'
import { reactive } from '../reactive'

describe('Reactive.map()', () => {
  it('should transform values using the map function', () => {
    const source = reactive(2)
    const doubled = source.map(n => n * 2)

    let result = 0
    const unsub = doubled.subscribe(val => result = val)

    expect(result).toBe(4)

    source.set(3)
    expect(result).toBe(6)

    unsub()
  })

  it('should allow chaining of map calls', () => {
    const source = reactive(1)
    const squaredThenDoubled = source.map(n => n ** 2).map(n => n * 2)

    let result = 0
    const unsub = squaredThenDoubled.subscribe(val => result = val)

    expect(result).toBe(2)

    source.set(3) // 3^2 = 9, *2 = 18
    expect(result).toBe(18)

    unsub()
  })

  it('should stop emitting after unsubscribe', () => {
    const source = reactive(2)
    const doubled = source.map(n => n * 2)

    let result = 0
    const unsub = doubled.subscribe(val => result = val)

    unsub()
    source.set(5)
    expect(result).toBe(4) // previous value, not updated
  })
})

describe('Reactive.filter()', () => {
  it('should only emit values that pass the filter condition', () => {
    const source = reactive(0)
    const nonZero = source.filter(n => n !== 0)

    let result: number | undefined
    const unsub = nonZero.subscribe(val => result = val)

    expect(result).toBeUndefined()

    source.set(5)
    expect(result).toBe(5)

    source.set(0)
    expect(result).toBe(5) // remains unchanged since 0 doesn't pass

    unsub()
  })

  it('should allow chaining of filter and map', () => {
    const source = reactive(0)
    const oddDoubled = source.filter(n => n % 2 === 1).map(n => n * 2)

    let result: number | undefined
    const unsub = oddDoubled.subscribe(val => result = val)

    source.set(2)
    expect(result).toBeUndefined()

    source.set(3)
    expect(result).toBe(6)

    source.set(4)
    expect(result).toBe(6)

    unsub()
  })

  it('should not throw errors on bad filters but silently skip values', () => {
    const source = reactive(1)
    const safeFilter = source.filter(n => {
      if (typeof n !== 'number') return false
      return n > 0
    })

    let result: number | undefined
    const unsub = safeFilter.subscribe(val => result = val)

    expect(result).toBe(1)

    // @ts-ignore
    source.set(null)
    expect(result).toBe(1)

    unsub()
  })
}) 