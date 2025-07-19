import { reactive } from '../packages/engine/src/reactive'
import { share } from '../packages/engine/src/share'
import { multicast } from '../packages/engine/src/multicast'

console.log('=== Share vs Multicast Comparison ===')

// Example 1: Basic behavior differences
console.log('\n--- Basic Behavior Differences ---')

const source = reactive(0)

// share() - Automatic connection management
console.log('Using share():')
const shared = share(source)

const sharedResults1: number[] = []
const sharedResults2: number[] = []

const sharedSub1 = shared.subscribe(val => {
  sharedResults1.push(val)
  console.log('Share subscriber 1:', val)
})

const sharedSub2 = shared.subscribe(val => {
  sharedResults2.push(val)
  console.log('Share subscriber 2:', val)
})

// share() auto-connects on first subscription
source.set(1)
source.set(2)

console.log('Share results 1:', sharedResults1)
console.log('Share results 2:', sharedResults2)

sharedSub1()
sharedSub2()

// multicast() - Manual connection control
console.log('\nUsing multicast():')
const multicasted = multicast(source)

const multiResults1: number[] = []
const multiResults2: number[] = []

const multiSubscriber1 = multicasted.subscribe(val => {
  multiResults1.push(val)
  console.log('Multicast subscriber 1:', val)
})

const multiSubscriber2 = multicasted.subscribe(val => {
  multiResults2.push(val)
  console.log('Multicast subscriber 2:', val)
})

// multicast() requires manual connect
source.set(3)
source.set(4)

console.log('Multicast results before connect:', multiResults1, multiResults2)

// Manual connection
;(multicasted as any).connect()
source.set(5)
source.set(6)

console.log('Multicast results after connect:', multiResults1, multiResults2)

multiSubscriber1()
multiSubscriber2()

// Example 2: Connection lifecycle
console.log('\n--- Connection Lifecycle ---')

const lifecycleSource = reactive(0)

console.log('Share lifecycle:')
const sharedLifecycle = share(lifecycleSource)
let shareConnectionCount = 0

const trackedSharedSource = {
  ...lifecycleSource,
  subscribe(callback: (value: number) => void) {
    shareConnectionCount++
    console.log('Share: Source connected, count:', shareConnectionCount)
    const unsub = lifecycleSource.subscribe(callback)
    return () => {
      shareConnectionCount--
      console.log('Share: Source disconnected, count:', shareConnectionCount)
      unsub()
    }
  }
}

const sharedTracked = share(trackedSharedSource)

const sub1 = sharedTracked.subscribe(() => {})
const sub2 = sharedTracked.subscribe(() => {})

lifecycleSource.set(1)

sub1() // Still connected
sub2() // Now disconnected

console.log('\nMulticast lifecycle:')
const multicastedLifecycle = multicast(lifecycleSource)
let multiConnectionCount = 0

const trackedMultiSource = {
  ...lifecycleSource,
  subscribe(callback: (value: number) => void) {
    multiConnectionCount++
    console.log('Multicast: Source connected, count:', multiConnectionCount)
    const unsub = lifecycleSource.subscribe(callback)
    return () => {
      multiConnectionCount--
      console.log('Multicast: Source disconnected, count:', multiConnectionCount)
      unsub()
    }
  }
}

const multiTracked = multicast(trackedMultiSource)

const multiSub1 = multiTracked.subscribe(() => {})
const multiSub2 = multiTracked.subscribe(() => {})

// No connection until connect() is called
lifecycleSource.set(2)

;(multiTracked as any).connect() // Manual connection
lifecycleSource.set(3)

multiSub1() // Still connected
multiSub2() // Now disconnected

// Example 3: Real-world scenarios
console.log('\n--- Real-world Scenarios ---')

// Scenario 1: API call sharing (use share for convenience)
console.log('Scenario 1: API call sharing (share)')
const apiCall = reactive({ data: null as any, loading: false })

const expensiveApiCall = {
  ...apiCall,
  subscribe(callback: (value: any) => void) {
    console.log('API call initiated')
    const unsub = apiCall.subscribe(callback)
    return () => {
      console.log('API call cleaned up')
      unsub()
    }
  }
}

const sharedApiCall = share(expensiveApiCall)

// Multiple components can subscribe - share auto-connects
const component1 = sharedApiCall.subscribe(data => {
  console.log('Component 1 received:', data)
})

const component2 = sharedApiCall.subscribe(data => {
  console.log('Component 2 received:', data)
})

// Only one API call is made
apiCall.set({ data: 'Shared API Response', loading: false })

component1()
component2()

// Scenario 2: Event stream with manual control (use multicast)
console.log('\nScenario 2: Event stream with manual control (multicast)')
const eventStream = reactive({ type: 'init', data: null as any })

const controlledEventStream = {
  ...eventStream,
  subscribe(callback: (value: any) => void) {
    console.log('Event listener attached')
    const unsub = eventStream.subscribe(callback)
    return () => {
      console.log('Event listener detached')
      unsub()
    }
  }
}

const multicastedEvents = multicast(controlledEventStream)

// Multiple components can subscribe
const tooltip = multicastedEvents.subscribe(event => {
  console.log('Tooltip received event:', event)
})

const analytics = multicastedEvents.subscribe(event => {
  console.log('Analytics received event:', event)
})

// Manual control - only connect when ready
console.log('Components ready, connecting event stream...')
;(multicastedEvents as any).connect()

eventStream.set({ type: 'click', data: { x: 100, y: 200 } })
eventStream.set({ type: 'keypress', data: { key: 'Enter' } })

tooltip()
analytics()

// Example 4: Advanced patterns
console.log('\n--- Advanced Patterns ---')

// Pattern 1: Conditional connection with multicast
console.log('Pattern 1: Conditional connection')
const conditionalSource = reactive(0)
const conditionalMulticast = multicast(conditionalSource)

const conditionalResults: number[] = []
const conditionalSub = conditionalMulticast.subscribe(val => {
  conditionalResults.push(val)
  console.log('Conditional subscriber:', val)
})

// Only connect when certain conditions are met
let shouldConnect = false

conditionalSource.set(1) // No emission
conditionalSource.set(2) // No emission

shouldConnect = true
if (shouldConnect) {
  console.log('Conditions met, connecting...')
  ;(conditionalMulticast as any).connect()
}

conditionalSource.set(3) // Now emits
conditionalSource.set(4) // Now emits

console.log('Conditional results:', conditionalResults)
conditionalSub()

// Pattern 2: Delayed connection with multicast
console.log('\nPattern 2: Delayed connection')
const delayedSource = reactive(0)
const delayedMulticast = multicast(delayedSource)

const delayedResults: number[] = []
const delayedSub = delayedMulticast.subscribe(val => {
  delayedResults.push(val)
  console.log('Delayed subscriber:', val)
})

// Connect after a delay
setTimeout(() => {
  console.log('Connecting after delay...')
  ;(delayedMulticast as any).connect()
  delayedSource.set(5)
  delayedSource.set(6)
}, 100)

// Pattern 3: share() as convenience over multicast()
console.log('\nPattern 3: share() as convenience')
const convenienceSource = reactive(0)

// share() is equivalent to multicast() with auto-connection
const sharedConvenience = share(convenienceSource)
const manualConvenience = multicast(convenienceSource)

// share() auto-connects
const sharedUnsub = sharedConvenience.subscribe(val => {
  console.log('Share convenience:', val)
})

// multicast() requires manual connect
const manualUnsub = manualConvenience.subscribe(val => {
  console.log('Manual convenience:', val)
})

convenienceSource.set(7)

// Manual connection for multicast
;(manualConvenience as any).connect()
convenienceSource.set(8)

sharedUnsub()
manualUnsub()

console.log('\nShare vs Multicast comparison completed!')
console.log('\nKey differences:')
console.log('- share(): Higher-level convenience with automatic connection management')
console.log('- multicast(): Lower-level primitive with manual connection control')
console.log('- share() internally uses multicast() for implementation')
console.log('- Use share() for most cases, multicast() when you need manual control') 