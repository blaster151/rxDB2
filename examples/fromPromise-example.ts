import { fromPromise, fromAsync, fromPromiseWithError } from '../packages/engine/src/fromPromise'

console.log('=== fromPromise Examples ===')

// Example 1: Basic Promise to Reactive
console.log('\n--- Basic Promise to Reactive ---')

const basicPromise = Promise.resolve('Hello from Promise!')
const basicStream = fromPromise(basicPromise)

basicStream.subscribe(value => {
  console.log('Basic promise result:', value)
})

// Example 2: Async function to Reactive
console.log('\n--- Async Function to Reactive ---')

const asyncFunction = async () => {
  // Simulate some async work
  await new Promise(resolve => setTimeout(resolve, 100))
  return 'Async function completed!'
}

const asyncStream = fromAsync(asyncFunction)

asyncStream.subscribe(value => {
  console.log('Async function result:', value)
})

// Example 3: Error handling with fromPromiseWithError
console.log('\n--- Error Handling ---')

const failingPromise = Promise.reject(new Error('Something went wrong!'))
const errorStream = fromPromiseWithError(failingPromise)

errorStream.subscribe(value => {
  if (value instanceof Error) {
    console.log('Error caught:', value.message)
  } else {
    console.log('Success:', value)
  }
})

// Example 4: API calls
console.log('\n--- API Calls ---')

// Simulate API call
const fetchUserData = async (userId: number) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200))
  
  if (userId === 1) {
    return { id: 1, name: 'John Doe', email: 'john@example.com' }
  } else {
    throw new Error('User not found')
  }
}

// Success case
const userStream = fromAsync(() => fetchUserData(1))
userStream.subscribe(user => {
  console.log('User data:', user)
})

// Error case
const errorUserStream2 = fromAsync(() => fetchUserData(999))
errorUserStream2.subscribe(user => {
  console.log('User data (should not reach here):', user)
})

// Example 5: Teardown before resolve
console.log('\n--- Teardown Before Resolve ---')

let resolveLatePromise: (value: string) => void
const latePromise = new Promise<string>(resolve => {
  resolveLatePromise = resolve
})

const lateStream = fromPromise(latePromise)
const results: string[] = []

const unsub = lateStream.subscribe(value => {
  if (value) results.push(value)
})

// Unsubscribe before promise resolves
unsub()

// Resolve the promise (should not emit)
setTimeout(() => {
  resolveLatePromise!('This should not be emitted')
  console.log('Results after teardown:', results) // Should be empty
}, 100)

// Example 6: Multiple subscribers
console.log('\n--- Multiple Subscribers ---')

const sharedPromise = Promise.resolve('Shared value')
const sharedStream = fromPromise(sharedPromise)

const unsub1 = sharedStream.subscribe(value => {
  console.log('Subscriber 1:', value)
})

const unsub2 = sharedStream.subscribe(value => {
  console.log('Subscriber 2:', value)
})

// Both should receive the same value
unsub1()
unsub2()

// Example 7: Complex data handling
console.log('\n--- Complex Data Handling ---')

interface User {
  id: number
  name: string
  posts: Post[]
}

interface Post {
  id: number
  title: string
  content: string
}

const fetchUserWithPosts = async (): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 150))
  return {
    id: 1,
    name: 'Alice',
    posts: [
      { id: 1, title: 'First Post', content: 'Hello world!' },
      { id: 2, title: 'Second Post', content: 'Another post' }
    ]
  }
}

const userWithPostsStream = fromAsync(fetchUserWithPosts)

userWithPostsStream.subscribe(user => {
  console.log('User with posts:', user)
  console.log(`User ${user.name} has ${user.posts.length} posts`)
})

// Example 8: Real-world pattern - Data fetching with error handling
console.log('\n--- Real-world Pattern ---')

class DataService {
  static async fetchData<T>(url: string): Promise<T> {
    // Simulate fetch
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (url.includes('error')) {
      throw new Error(`Failed to fetch from ${url}`)
    }
    
    return { data: 'success', url } as T
  }

  static createDataStream<T>(url: string) {
    return fromAsync(() => this.fetchData<T>(url))
  }
}

// Success case
const successStream = DataService.createDataStream('/api/users')
successStream.subscribe(data => {
  console.log('Data fetched successfully:', data)
})

// Error case
const errorDataStream = DataService.createDataStream('/api/error')
errorDataStream.subscribe(data => {
  console.log('Data (should not reach here):', data)
})

// Example 9: Chaining with other reactive operators
console.log('\n--- Chaining with Operators ---')

const numberPromise = Promise.resolve(42)
const numberStream = fromPromise(numberPromise)

// Chain with map operator
const doubledStream = numberStream.map(n => n * 2)
doubledStream.subscribe(value => {
  console.log('Doubled value:', value)
})

// Chain with filter operator
const filteredStream = numberStream.filter(n => n > 40)
filteredStream.subscribe(value => {
  console.log('Filtered value (>40):', value)
})

console.log('\nExamples completed!')

// Example 10: Memory management demonstration
console.log('\n--- Memory Management ---')

const memoryPromise = Promise.resolve('Memory test')
const memoryStream = fromPromise(memoryPromise)

// Create and immediately unsubscribe multiple times
for (let i = 0; i < 5; i++) {
  const unsub = memoryStream.subscribe(value => {
    console.log(`Memory test ${i}:`, value)
  })
  unsub() // Immediate unsubscribe
}

// Should still work after multiple subscribe/unsubscribe cycles
const finalUnsub = memoryStream.subscribe(value => {
  console.log('Final memory test:', value)
})

finalUnsub() 