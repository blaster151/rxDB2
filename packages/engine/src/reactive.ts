// engine/src/reactive.ts
import { Observable, createObservable } from './createObservable'

export interface Reactive<T> extends Observable<T> {
  map<U>(fn: (value: T) => U): Reactive<U>
  filter(fn: (value: T) => boolean): Reactive<T>
}

export function reactive<T>(initial: T): Reactive<T> {
  const base = createObservable(initial)

  function map<U>(fn: (value: T) => U): Reactive<U> {
    const derived = reactive(fn(base.get()))
    const unsub = base.subscribe(val => {
      derived.set(fn(val))
    })
    return withCleanup(derived, unsub)
  }

  function filter(fn: (value: T) => boolean): Reactive<T> {
    const derived = reactive(fn(base.get()) ? base.get() : initial)
    const unsub = base.subscribe(val => {
      if (fn(val)) derived.set(val)
    })
    return withCleanup(derived, unsub)
  }

  const self = base as Reactive<T>
  self.map = map
  self.filter = filter
  return self
}

function withCleanup<T>(r: Reactive<T>, unsubscribe: () => void): Reactive<T> {
  const original = r.subscribe
  r.subscribe = (fn) => {
    const unsub = original(fn)
    return () => {
      unsub()
      unsubscribe()
    }
  }
  return r
} 