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
  let outerCompleted = false
  
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
  let otherHasEmitted = false
  const result = reactive([] as [T, U][])
  let sourceUnsub: (() => void) | null = null
  let otherUnsub: (() => void) | null = null

  otherUnsub = other.subscribe((val: U) => {
    latestOther = val
    otherHasEmitted = true
  })

  sourceUnsub = source.subscribe((val: T) => {
    if (otherHasEmitted && latestOther !== undefined) {
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

// combineLatest operator
export function combineLatest<T, U>(a: any, b: any): any {
  let latestA: T | undefined
  let latestB: U | undefined
  let aHasEmitted = false
  let bHasEmitted = false
  const result = reactive([] as [T, U][])
  let aUnsub: (() => void) | null = null
  let bUnsub: (() => void) | null = null

  const tryEmit = () => {
    if (aHasEmitted && bHasEmitted && latestA !== undefined && latestB !== undefined) {
      result.set([...result.get(), [latestA, latestB]])
    }
  }

  aUnsub = a.subscribe((val: T) => {
    latestA = val
    aHasEmitted = true
    tryEmit()
  })

  bUnsub = b.subscribe((val: U) => {
    latestB = val
    bHasEmitted = true
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

// retry operator
export function retry<T>(source: any, maxRetries: number): any {
  const result = reactive(source.get())
  let retryCount = 0
  let currentUnsub: (() => void) | null = null
  
  const subscribeToSource = () => {
    currentUnsub = source.subscribe(
      (value: T) => {
        result.set(value)
        retryCount = 0 // Reset retry count on success
      },
      (error: any) => {
        if (retryCount < maxRetries) {
          retryCount++
          // Resubscribe to source
          if (currentUnsub) {
            currentUnsub()
          }
          subscribeToSource()
        } else {
          // Max retries reached, emit error
          console.error('Max retries reached:', error)
        }
      }
    )
  }
  
  subscribeToSource()
  
  return createReactiveWithCleanup(result.get(), () => {
    if (currentUnsub) {
      currentUnsub()
      currentUnsub = null
    }
  })
}

// catchError operator
export function catchError<T>(source: any, errorHandler: (error: any) => any): any {
  const result = reactive(source.get())
  let sourceUnsub: (() => void) | null = null
  let fallbackUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe(
    (value: T) => {
      result.set(value)
    },
    (error: any) => {
      // Switch to fallback stream
      const fallback = errorHandler(error)
      if (fallbackUnsub) {
        fallbackUnsub()
      }
      fallbackUnsub = fallback.subscribe((value: T) => {
        result.set(value)
      })
    }
  )
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
    if (fallbackUnsub) {
      fallbackUnsub()
      fallbackUnsub = null
    }
  })
}

// startWith operator
export function startWith<T>(source: any, value: T): any {
  const result = reactive(value)
  let sourceUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((val: T) => {
    result.set(val)
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
  })
}

// scan operator
export function scan<T, U>(source: any, reducer: (acc: U, val: T) => U, seed: U): any {
  const result = reactive(seed)
  let sourceUnsub: (() => void) | null = null
  let accumulator = seed
  
  sourceUnsub = source.subscribe((value: T) => {
    accumulator = reducer(accumulator, value)
    result.set(accumulator)
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
  })
}

// tap operator - for side effects without altering the stream
export function tap<T>(source: any, fn: (value: T) => void): any {
  const result = reactive(source.get())
  let sourceUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((value: T) => {
    // Execute side effect
    fn(value)
    // Forward value unchanged
    result.set(value)
  })
  
  return createReactiveWithCleanup(result.get(), () => {
    if (sourceUnsub) {
      sourceUnsub()
      sourceUnsub = null
    }
  })
}

// concatMap operator - sequential mapping with inner stream completion
export function concatMap<T, U>(source: any, project: (value: T) => any): any {
  const result = reactive([] as U[])
  let sourceUnsub: (() => void) | null = null
  let currentInnerUnsub: (() => void) | null = null
  let sourceCompleted = false
  let innerCompleted = true
  const queue: T[] = []
  
  const processNext = () => {
    if (queue.length === 0) {
      if (sourceCompleted && innerCompleted) {
        // Both source and inner completed, we're done
        return
      }
      return
    }
    
    if (!innerCompleted) {
      // Still processing current inner, wait
      return
    }
    
    const value = queue.shift()!
    innerCompleted = false
    
    const inner = project(value)
    currentInnerUnsub = inner.subscribe(
      (innerValue: U) => {
        result.set([...result.get(), innerValue])
      },
      (error: any) => {
        // Inner error propagates immediately
        console.error('Inner observable error:', error)
        if (currentInnerUnsub) {
          currentInnerUnsub()
          currentInnerUnsub = null
        }
      },
      () => {
        // Inner completed, process next
        innerCompleted = true
        if (currentInnerUnsub) {
          currentInnerUnsub()
          currentInnerUnsub = null
        }
        processNext()
      }
    )
  }
  
  sourceUnsub = source.subscribe(
    (value: T) => {
      queue.push(value)
      processNext()
    },
    (error: any) => {
      // Source error propagates immediately
      console.error('Source observable error:', error)
      if (currentInnerUnsub) {
        currentInnerUnsub()
        currentInnerUnsub = null
      }
    },
    () => {
      // Source completed
      sourceCompleted = true
      processNext()
    }
  )
  
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