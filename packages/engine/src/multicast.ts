import { reactive } from './reactive'

export function multicast<T>(source: any): any {
  let subscribers: Set<(value: T) => void> = new Set()
  let subscription: (() => void) | undefined
  let isConnected = false

  const multicasted = reactive(source.get())
  
  // Override the subscribe method to implement multicast
  const originalSubscribe = multicasted.subscribe
  multicasted.subscribe = function(subscriber: (value: T) => void) {
    subscribers.add(subscriber)

    const unsub = originalSubscribe.call(this, subscriber)
    
    return () => {
      subscribers.delete(subscriber)
      unsub()
      
      if (subscribers.size === 0 && subscription) {
        subscription()
        subscription = undefined
        isConnected = false
      }
    }
  }

  // Add connect method for manual control
  ;(multicasted as any).connect = function() {
    if (!isConnected && subscribers.size > 0) {
      isConnected = true
      subscription = source.subscribe((value: T) => {
        multicasted.set(value)
        // Notify all subscribers
        for (const s of subscribers) {
          s(value)
        }
      })
    }
  }

  return multicasted
} 