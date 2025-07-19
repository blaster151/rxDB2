import { reactive } from './reactive'
import { zodMap } from './operators/zodMap'

// Helper function to create a reactive with cleanup
function createReactiveWithCleanup<T>(initial: T, cleanup: () => void): any {
  const r = reactive(initial)
  const originalSubscribe = r.subscribe
  r.subscribe = function(callback) {
    const unsub = originalSubscribe.call(this, callback)
    return () => {
      unsub()
      cleanup()
    }
  }
  return r
}

export function takeWhile<T>(source: any, predicate: (value: T) => boolean): any {
  const result = reactive(source.get())
  let sourceUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((value: T) => {
    if (predicate(value)) {
      result.set(value)
    } else {
      // Stop listening to source when predicate fails
      if (sourceUnsub) {
        sourceUnsub()
        sourceUnsub = null
      }
    }
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
  })
}

// Re-export zodMap for convenience
export { zodMap }

// sample operator
export function sample<T>(source: any, notifier: any): any {
  let latest: T | undefined
  const result = reactive(latest as T)
  let sourceUnsub: (() => void) | null = null
  let notifierUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((value: T) => {
    latest = value
  })
  
  notifierUnsub = notifier.subscribe(() => {
    if (latest !== undefined) result.set(latest)
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
    if (notifierUnsub) {
      notifierUnsub()
      notifierUnsub = null
    }
  })
}

// switchMap operator
export function switchMap<T, U>(source: any, project: (value: T) => any): any {
  const result = reactive([] as U[])
  let sourceUnsub: (() => void) | null = null
  let currentInnerUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((value: T) => {
    // Unsubscribe from previous inner stream
    if (currentInnerUnsub) {
      currentInnerUnsub()
      currentInnerUnsub = null
    }
    
    // Subscribe to new inner stream
    const inner = project(value)
    currentInnerUnsub = inner.subscribe((innerValue: U) => {
      result.set([...result.get(), innerValue])
    })
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
    if (currentInnerUnsub) {
      currentInnerUnsub()
      currentInnerUnsub = null
    }
  })
}

// mergeMap operator
export function mergeMap<T, U>(source: any, project: (value: T) => any): any {
  const subscriptions: (() => void)[] = []
  const result = reactive([] as U[])
  let sourceUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((value: T) => {
    const inner = project(value)
    const innerSub = inner.subscribe((innerValue: U) => {
      result.set([...result.get(), innerValue])
    })
    subscriptions.push(innerSub)
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
    // Clean up all inner subscriptions
    subscriptions.forEach(unsub => unsub())
    subscriptions.length = 0
  })
}

// zip operator
export function zip<T, U>(a: any, b: any): any {
  const bufferA: T[] = []
  const bufferB: U[] = []
  const result = reactive([] as [T, U][])
  let aUnsub: (() => void) | null = null
  let bUnsub: (() => void) | null = null

  const tryEmit = () => {
    if (bufferA.length && bufferB.length) {
      result.set([...result.get(), [bufferA.shift()!, bufferB.shift()!]])
    }
  }

  aUnsub = a.subscribe((val: T) => {
    bufferA.push(val)
    tryEmit()
  })

  bUnsub = b.subscribe((val: U) => {
    bufferB.push(val)
    tryEmit()
  })

  return createReactiveWithCleanup(result.get(), () => {
    if (aUnsub) {
      aUnsub()
      aUnsub = null
    }
    if (bUnsub) {
      bUnsub()
      bUnsub = null
    }
  })
}

// withLatestFrom operator
export function withLatestFrom<T, U>(source: any, other: any): any {
  let latestOther: U | undefined
  const result = reactive([] as [T, U][])
  let sourceUnsub: (() => void) | null = null
  let otherUnsub: (() => void) | null = null

  otherUnsub = other.subscribe((val: U) => {
    latestOther = val
  })

  sourceUnsub = source.subscribe((val: T) => {
    if (latestOther !== undefined) {
      result.set([...result.get(), [val, latestOther]])
    }
  })

  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
    if (otherUnsub) {
      otherUnsub()
      otherUnsub = null
    }
  })
}

// delay operator
export function delay<T>(source: any, delayMs: number): any {
  const result = reactive(source.get())
  let sourceUnsub: (() => void) | null = null
  const timers: number[] = []
  
  sourceUnsub = source.subscribe((value: T) => {
    const timer = setTimeout(() => {
      result.set(value)
      const index = timers.indexOf(timer)
      if (index > -1) {
        timers.splice(index, 1)
      }
    }, delayMs)
    timers.push(timer)
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
    // Clear all pending timers
    timers.forEach(timer => clearTimeout(timer))
    timers.length = 0
  })
}

// pairwise operator
export function pairwise<T>(source: any): any {
  const result = reactive([] as [T, T][])
  let sourceUnsub: (() => void) | null = null
  let previous: T | undefined
  
  sourceUnsub = source.subscribe((value: T) => {
    if (previous !== undefined) {
      result.set([...result.get(), [previous, value]])
    }
    previous = value
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
  })
} 