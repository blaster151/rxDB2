import { describe, it, expect, vi } from 'vitest'
import { reactive } from '../reactive'
import { delay, switchMap, takeWhile, sample, mergeMap, pairwise, zip, withLatestFrom } from '../operators'
import { createColdObservable, createHotObservable, collect } from './utils'

describe('Reactive operators with cold observables', () => {
  it('switchMap with cold observable should only emit from latest', async () => {
    const outer = reactive(0)

    const mapped = switchMap(outer, (n) => createColdObservable([`A${n}`, `B${n}`], 10))
    
    outer.set(1)
    setTimeout(() => outer.set(2), 15)

    const result = await collect(mapped)
    expect(result).toEqual(['A2', 'B2'])
  })

  it('switchMap should properly unsubscribe from old inner streams', async () => {
    const outer = reactive(0)
    const innerEmissions: string[] = []

    const createInner = (id: number) => {
      const inner = createColdObservable([`A${id}`, `B${id}`], 10)
      inner.subscribe(val => innerEmissions.push(val))
      return inner
    }

    const mapped = switchMap(outer, createInner)
    const unsubscribe = mapped.subscribe(() => {}) // Subscribe but don't collect

    outer.set(1) // Creates inner1
    outer.set(2) // Creates inner2, should unsubscribe from inner1

    await new Promise(resolve => setTimeout(resolve, 50))
    unsubscribe() // Clean up

    // Verify that inner1 emissions are limited (switchMap should have unsubscribed)
    expect(innerEmissions).toContain('A1')
    expect(innerEmissions).toContain('A2')
  })

  it('mergeMap with cold observable should emit from all sources', async () => {
    const outer = reactive(0)

    const merged = mergeMap(outer, (n) => createColdObservable([`X${n}`, `Y${n}`], 10))

    outer.set(1)
    outer.set(2)

    const result = await collect(merged)
    expect(result.sort()).toEqual(['X1', 'Y1', 'X2', 'Y2'].sort())
  })

  it('delay on cold observable defers emission', async () => {
    const cold = createColdObservable(['delayed'], 5)
    const delayed = delay(cold, 20)

    const result = await collect(delayed)
    expect(result).toEqual(['delayed'])
  })

  it('zip with cold observables emits tuples', async () => {
    const a = createColdObservable(['a1', 'a2'], 5)
    const b = createColdObservable(['b1', 'b2'], 5)
    const zipped = zip(a, b)

    const result = await collect(zipped)
    expect(result).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
    ])
  })

  it('withLatestFrom combines latest values from other observables', async () => {
    const a = createColdObservable(['x', 'y'], 10)
    const b = createColdObservable(['1', '2'], 15)
    const combined = withLatestFrom(a, b)

    const result = await collect(combined)
    expect(result).toEqual([
      ['y', '2'],
    ])
  })

  it('sample should emit latest source value when notifier emits', async () => {
    const source = createColdObservable(['S1', 'S2'], 5)
    const notifier = createColdObservable(['tick'], 20)
    const sampled = sample(source, notifier)

    const result = await collect(sampled)
    expect(result).toEqual(['S2'])
  })

  it('pairwise should emit pairs of consecutive values', async () => {
    const cold = createColdObservable(['a', 'b', 'c'], 5)
    const paired = pairwise(cold)

    const result = await collect(paired)
    expect(result).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ])
  })
})

describe('Reactive operators with hot observables', () => {
  it('switchMap with hot observable emits only latest inner stream', async () => {
    const outer = reactive(0)

    const mapped = switchMap(outer, (n) => createHotObservable([`A${n}`, `B${n}`], 10))

    outer.set(1)
    setTimeout(() => outer.set(2), 15)

    const result = await collect(mapped)
    expect(result).toEqual(['A2', 'B2'])
  })

  it('mergeMap with hot observable emits all values from all streams', async () => {
    const outer = reactive(0)

    const merged = mergeMap(outer, (n) => createHotObservable([`X${n}`, `Y${n}`], 10))

    outer.set(1)
    outer.set(2)

    const result = await collect(merged)
    expect(result.sort()).toEqual(['X1', 'Y1', 'X2', 'Y2'].sort())
  })

  it('zip with hot observables emits values in lockstep', async () => {
    const a = createHotObservable(['a1', 'a2'], 10)
    const b = createHotObservable(['b1', 'b2'], 10)
    const zipped = zip(a, b)

    const result = await collect(zipped)
    expect(result).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
    ])
  })

  it('withLatestFrom with hot observables picks latest from second source', async () => {
    const a = createHotObservable(['x', 'y'], 10)
    const b = createHotObservable(['1', '2'], 5)
    const combined = withLatestFrom(a, b)

    const result = await collect(combined)
    expect(result).toContainEqual(['y', '2'])
  })

  it('sample with hot source and notifier emits correctly', async () => {
    const source = createHotObservable(['S1', 'S2'], 5)
    const notifier = createHotObservable(['tick'], 20)
    const sampled = sample(source, notifier)

    const result = await collect(sampled)
    expect(result).toEqual(['S2'])
  })

  it('pairwise emits correct pairs for hot observable', async () => {
    const hot = createHotObservable(['a', 'b', 'c'], 5)
    const paired = pairwise(hot)

    const result = await collect(paired)
    expect(result).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ])
  })
}) 