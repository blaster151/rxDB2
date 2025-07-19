import { reactive } from '../packages/engine/src/reactive'
import { share } from '../packages/engine/src/share'

console.log('=== Share Operator Examples ===')

// Example 1: Basic sharing behavior
console.log('\n--- Basic Sharing ---')

const source = reactive(0)
const shared = share(source)

const results1: number[] = []
const results2: number[] = []
const results3: number[] = []

const unsub1 = shared.subscribe(val => {
  results1.push(val)
  console.log('Observer 1:', val)
})

const unsub2 = shared.subscribe(val => {
  results2.push(val)
  console.log('Observer 2:', val)
})

const unsub3 = shared.subscribe(val => {
  results3.push(val)
  console.log('Observer 3:', val)
})

source.set(1)
source.set(2)
source.set(3)

console.log('Results 1:', results1)
console.log('Results 2:', results2)
console.log('Results 3:', results3)

unsub1()
unsub2()
unsub3()

// Example 2: Reference counting
console.log('\n--- Reference Counting ---')

let subscriptionCount = 0
const trackedSource = {
  ...source,
  subscribe(callback: (value: number) => void) {
    subscriptionCount++
    console.log('Source subscription created, count:', subscriptionCount)
    const unsub = source.subscribe(callback)
    return () => {
      subscriptionCount--
      console.log('Source subscription removed, count:', subscriptionCount)
      unsub()
    }
  }
}

const refCounted = share(trackedSource)

const sub1 = refCounted.subscribe(() => {})
const sub2 = refCounted.subscribe(() => {})
const sub3 = refCounted.subscribe(() => {})

console.log('After 3 subscriptions, source count:', subscriptionCount)

sub1()
console.log('After 1st unsubscribe, source count:', subscriptionCount)

sub2()
console.log('After 2nd unsubscribe, source count:', subscriptionCount)

sub3()
console.log('After 3rd unsubscribe, source count:', subscriptionCount)

// Example 3: Multicast semantics
console.log('\n--- Multicast Semantics ---')

const multicastSource = reactive('initial')
const multicast = share(multicastSource)

const multiResults1: string[] = []
const multiResults2: string[] = []
const multiResults3: string[] = []

const multi1 = multicast.subscribe(val => {
  multiResults1.push(val)
  console.log('Multicast 1:', val)
})

multicastSource.set('first')

const multi2 = multicast.subscribe(val => {
  multiResults2.push(val)
  console.log('Multicast 2:', val)
})

multicastSource.set('second')

const multi3 = multicast.subscribe(val => {
  multiResults3.push(val)
  console.log('Multicast 3:', val)
})

multicastSource.set('third')

multi1()
multicastSource.set('fourth')

multi2()
multicastSource.set('fifth')

multi3()

console.log('Multicast results 1:', multiResults1)
console.log('Multicast results 2:', multiResults2)
console.log('Multicast results 3:', multiResults3)

// Example 4: Integration with operators
console.log('\n--- Operator Integration ---')

const operatorSource = reactive(0)
const sharedOperator = share(operatorSource)
const transformed = sharedOperator
  .map(x => x * 2)
  .filter(x => x > 0)
  .map(x => `Value: ${x}`)

const opResults1: string[] = []
const opResults2: string[] = []

const op1 = transformed.subscribe(val => {
  opResults1.push(val)
  console.log('Transformed 1:', val)
})

const op2 = transformed.subscribe(val => {
  opResults2.push(val)
  console.log('Transformed 2:', val)
})

operatorSource.set(1)
operatorSource.set(2)
operatorSource.set(3)

op1()
op2()

console.log('Transformed results 1:', opResults1)
console.log('Transformed results 2:', opResults2)

// Example 5: Real-world pattern - API call sharing
console.log('\n--- Real-world Pattern: API Call Sharing ---')

// Simulate an expensive API call
let apiCallCount = 0
const apiCall = reactive({ data: null as any, loading: false })

const expensiveApiCall = {
  ...apiCall,
  subscribe(callback: (value: any) => void) {
    apiCallCount++
    console.log(`API call #${apiCallCount} initiated`)
    
    // Simulate API call
    setTimeout(() => {
      apiCall.set({ data: `API Response ${apiCallCount}`, loading: false })
      callback(apiCall.get())
    }, 100)
    
    const unsub = apiCall.subscribe(callback)
    return () => {
      apiCallCount--
      console.log(`API call #${apiCallCount} cleaned up`)
      unsub()
    }
  }
}

const sharedApiCall = share(expensiveApiCall)

// Multiple components subscribe to the same API call
const component1 = sharedApiCall.subscribe(data => {
  console.log('Component 1 received:', data)
})

const component2 = sharedApiCall.subscribe(data => {
  console.log('Component 2 received:', data)
})

const component3 = sharedApiCall.subscribe(data => {
  console.log('Component 3 received:', data)
})

// Simulate API response
setTimeout(() => {
  apiCall.set({ data: 'Shared API Response', loading: false })
}, 50)

// Cleanup
setTimeout(() => {
  component1()
  component2()
  component3()
}, 200)

// Example 6: Edge cases
console.log('\n--- Edge Cases ---')

const edgeSource = reactive(0)
const edgeShared = share(edgeSource)

// Test unsubscribe during emission
let edgeUnsub: (() => void) | null = null
const edgeResults: number[] = []

edgeUnsub = edgeShared.subscribe(val => {
  edgeResults.push(val)
  if (val === 1 && edgeUnsub) {
    console.log('Unsubscribing during emission')
    edgeUnsub()
  }
})

edgeSource.set(1)
edgeSource.set(2) // Should not be received

console.log('Edge case results:', edgeResults)

// Test multiple unsubscribes
const safeUnsub = edgeShared.subscribe(() => {})
safeUnsub()
safeUnsub() // Should not throw
safeUnsub() // Should not throw

console.log('Multiple unsubscribes completed safely')

// Example 7: Memory management
console.log('\n--- Memory Management ---')

const memorySource = reactive(0)
const memoryShared = share(memorySource)

let memoryCount = 0
const trackedMemorySource = {
  ...memorySource,
  subscribe(callback: (value: number) => void) {
    memoryCount++
    console.log('Memory subscription created, count:', memoryCount)
    const unsub = memorySource.subscribe(callback)
    return () => {
      memoryCount--
      console.log('Memory subscription removed, count:', memoryCount)
      unsub()
    }
  }
}

const memoryShared2 = share(trackedMemorySource)

const mem1 = memoryShared2.subscribe(() => {})
const mem2 = memoryShared2.subscribe(() => {})

console.log('Memory subscriptions:', memoryCount)

mem1()
mem2()

console.log('After cleanup, memory subscriptions:', memoryCount)

// Test resubscription
const mem3 = memoryShared2.subscribe(() => {})
console.log('After resubscription, memory subscriptions:', memoryCount)
mem3()
console.log('After final cleanup, memory subscriptions:', memoryCount)

console.log('\nShare operator examples completed!') 