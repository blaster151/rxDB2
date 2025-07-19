import { reactive } from '../reactive'

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function collect<T>(reactive: any): Promise<T[]> {
  const result: T[] = [];
  reactive.subscribe((v: T) => result.push(v));
  return new Promise((resolve) => {
    setTimeout(() => resolve(result), 100);
  });
}

export function createColdObservable<T>(values: T[], delayMs = 0): any {
  const r = reactive(values[0] || undefined)
  values.forEach((v, i) => {
    setTimeout(() => r.set(v), delayMs * (i + 1))
  })
  return r
}

export function createHotObservable<T>(values: T[], intervalMs = 10): any {
  const r = reactive(values[0] || undefined)
  let index = 0
  const id = setInterval(() => {
    if (index < values.length) {
      r.set(values[index++])
    } else {
      clearInterval(id)
    }
  }, intervalMs)
  return r
}

export function createObservableFactory<T>(values: T[], timing: 'cold' | 'hot', ms: number): () => any {
  return () =>
    timing === 'cold'
      ? createColdObservable(values, ms)
      : createHotObservable(values, ms);
} 