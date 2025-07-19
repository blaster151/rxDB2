type Subscriber<T> = (value: T) => void

export interface Observable<T> {
  get(): T
  set(newValue: T): void
  subscribe(callback: Subscriber<T>): () => void
}

export function createObservable<T>(initialValue: T): Observable<T> {
  let value = initialValue
  const subscribers = new Set<Subscriber<T>>()

  const notify = () => {
    for (const callback of subscribers) {
      callback(value)
    }
  }

  return {
    get() {
      return value
    },
    set(newValue: T) {
      value = newValue
      notify()
    },
    subscribe(callback: Subscriber<T>) {
      subscribers.add(callback)
      // Immediately call with current value
      callback(value)
      return () => {
        subscribers.delete(callback)
      }
    }
  }
} 