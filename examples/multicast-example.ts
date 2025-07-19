import { reactive } from '../packages/engine/src/reactive'
import { multicast } from '../packages/engine/src/multicast'

console.log('=== Multicast Operator Examples ===')

// Example 1: Basic multicast behavior
console.log('\n--- Basic Multicast ---')

const source = reactive(0)
const multicasted = multicast(source)

const results1: number[] = []
const results2: number[] = []
const results3: number[] = []

const unsub1 = multicasted.subscribe(val => {
  results1.push(val)
  console.log('Subscriber 1:', val)
})

const unsub2 = multicasted.subscribe(val => {
  results2.push(val)
  console.log('Subscriber 2:', val)
})

const unsub3 = multicasted.subscribe(val => {
  results3.push(val)
  console.log('Subscriber 3:', val)
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

// Example 2: Subscriber management
console.log('\n--- Subscriber Management ---')

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

const managed = multicast(trackedSource)

const sub1 = managed.subscribe(() => {})
const sub2 = managed.subscribe(() => {})
const sub3 = managed.subscribe(() => {})

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
const multicastStream = multicast(multicastSource)

const multiResults1: string[] = []
const multiResults2: string[] = []
const multiResults3: string[] = []

const multi1 = multicastStream.subscribe(val => {
  multiResults1.push(val)
  console.log('Multicast 1:', val)
})

multicastSource.set('first')

const multi2 = multicastStream.subscribe(val => {
  multiResults2.push(val)
  console.log('Multicast 2:', val)
})

multicastSource.set('second')

const multi3 = multicastStream.subscribe(val => {
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
const multicastedOperator = multicast(operatorSource)
const transformed = multicastedOperator
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

// Example 5: Real-world pattern - Event stream sharing
console.log('\n--- Real-world Pattern: Event Stream Sharing ---')

// Simulate a shared event stream
let eventListenerCount = 0
const eventStream = reactive({ type: 'init', data: null as any })

const sharedEventStream = {
  ...eventStream,
  subscribe(callback: (value: any) => void) {
    eventListenerCount++
    console.log(`Event listener #${eventListenerCount} attached`)
    
    const unsub = eventStream.subscribe(callback)
    return () => {
      eventListenerCount--
      console.log(`Event listener #${eventListenerCount} detached`)
      unsub()
    }
  }
}

const multicastedEvents = multicast(sharedEventStream)

// Multiple components listen to the same event stream
const component1 = multicastedEvents.subscribe(event => {
  console.log('Component 1 received event:', event)
})

const component2 = multicastedEvents.subscribe(event => {
  console.log('Component 2 received event:', event)
})

const component3 = multicastedEvents.subscribe(event => {
  console.log('Component 3 received event:', event)
})

// Simulate events
eventStream.set({ type: 'click', data: { x: 100, y: 200 } })
eventStream.set({ type: 'keypress', data: { key: 'Enter' } })

// Cleanup
component1()
component2()
component3()

// Example 6: Edge cases
console.log('\n--- Edge Cases ---')

const edgeSource = reactive(0)
const edgeMulticast = multicast(edgeSource)

// Test unsubscribe during emission
let edgeUnsub: (() => void) | null = null
const edgeResults: number[] = []

edgeUnsub = edgeMulticast.subscribe(val => {
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
const safeUnsub = edgeMulticast.subscribe(() => {})
safeUnsub()
safeUnsub() // Should not throw
safeUnsub() // Should not throw

console.log('Multiple unsubscribes completed safely')

// Example 7: Memory management
console.log('\n--- Memory Management ---')

const memorySource = reactive(0)
const memoryMulticast = multicast(memorySource)

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

const memoryMulticast2 = multicast(trackedMemorySource)

const mem1 = memoryMulticast2.subscribe(() => {})
const mem2 = memoryMulticast2.subscribe(() => {})

console.log('Memory subscriptions:', memoryCount)

mem1()
mem2()

console.log('After cleanup, memory subscriptions:', memoryCount)

// Test resubscription
const mem3 = memoryMulticast2.subscribe(() => {})
console.log('After resubscription, memory subscriptions:', memoryCount)
mem3()
console.log('After final cleanup, memory subscriptions:', memoryCount)

// Example 8: Comparison with share operator
console.log('\n--- Comparison with Share Operator ---')

const compareSource = reactive(0)
const multicastedCompare = multicast(compareSource)

const compareResults1: number[] = []
const compareResults2: number[] = []

const comp1 = multicastedCompare.subscribe(val => {
  compareResults1.push(val)
  console.log('Multicast subscriber 1:', val)
})

const comp2 = multicastedCompare.subscribe(val => {
  compareResults2.push(val)
  console.log('Multicast subscriber 2:', val)
})

compareSource.set(1)
compareSource.set(2)
compareSource.set(3)

comp1()
comp2()

console.log('Multicast comparison results 1:', compareResults1)
console.log('Multicast comparison results 2:', compareResults2)

console.log('\nMulticast operator examples completed!') 