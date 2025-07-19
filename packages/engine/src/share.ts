import { multicast } from './multicast'

export function share<T>(source: any): any {
  let refCount = 0
  const multicasted = multicast(source)
  
  // Override the subscribe method to provide automatic connection management
  const originalSubscribe = multicasted.subscribe
  multicasted.subscribe = function(callback: (value: T) => void) {
    refCount++
    
    // Auto-connect on first subscription
    if (refCount === 1) {
      ;(multicasted as any).connect()
    }

    const unsub = originalSubscribe.call(this, callback)
    
    return () => {
      refCount--
      unsub()
      
      // Auto-disconnect on last unsubscription
      if (refCount === 0) {
        // The multicast operator will handle the cleanup
      }
    }
  }

  return multicasted
} 