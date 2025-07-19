import { reactive } from '../packages/engine/src/reactive'
import { 
  retry, 
  catchError, 
  startWith, 
  scan,
  combineLatest,
  withLatestFrom,
  switchMap,
  concatMap,
  mergeMap,
  delay,
  map,
  filter
} from '../packages/engine/src/operators'
import { collect } from '../packages/engine/src/__tests__/utils'

console.log('=== Core Operators Examples ===')

// Example 1: Basic transformation and accumulation
console.log('\n--- Basic Transformation and Accumulation ---')

const numbers = reactive([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

// Transform: square each number
const squaredNumbers = numbers.map((arr: number[]) => arr.map(n => n * n))

// Filter: keep only even numbers
const evenNumbers = squaredNumbers.map((arr: number[]) => arr.filter(n => n % 2 === 0))

// Accumulate: scan is similar to reduce but emits intermediate states
// Each emission contains the accumulated result up to that point
const accumulatedEvenSquares = scan(evenNumbers, (acc: number[], val: number[]) => [...acc, ...val], [])

// Collect all results using async/await for deferred execution
const finalResult = await collect(accumulatedEvenSquares)
console.log('Final accumulated even squares:', finalResult)
// Output: [4, 16, 36, 64, 100] - all even squares from 1-10

// Example 2: Flattening with concatMap (sequential processing)
console.log('\n--- Flattening with ConcatMap (Sequential) ---')

const userIds = reactive(['user1', 'user2', 'user3'])

// Simulate async user data fetching
const fetchUserData = (userId: string) => {
  return reactive([{ id: userId, name: `User ${userId}`, email: `${userId}@example.com` }]).pipe(
    delay(100) // Simulate network delay
  )
}

// concatMap processes items sequentially - waits for each to complete
const sequentialUserData = concatMap(userIds, fetchUserData)
const sequentialResults = await collect(sequentialUserData)
console.log('Sequential user data:', sequentialResults)
// Output: All user data processed one after another

// Example 3: Flattening with switchMap (cancellation)
console.log('\n--- Flattening with SwitchMap (Cancellation) ---')

const searchQueries = reactive(['react', 'react hooks', 'react performance'])

// Simulate search API calls
const searchAPI = (query: string) => {
  return reactive([`Results for: ${query}`]).pipe(
    delay(200) // Simulate API delay
  )
}

// switchMap cancels previous inner observable when new value arrives
const searchResults = switchMap(searchQueries, searchAPI)
const switchResults = await collect(searchResults)
console.log('Search results (only last query):', switchResults)
// Output: Only results from the last query due to cancellation

// Example 4: Flattening with mergeMap (concurrent processing)
console.log('\n--- Flattening with MergeMap (Concurrent) ---')

const requestIds = reactive(['req1', 'req2', 'req3', 'req4'])

// Simulate concurrent API requests
const processRequest = (reqId: string) => {
  return reactive([`Processed ${reqId}`]).pipe(
    delay(Math.random() * 100) // Random delay to simulate real-world timing
  )
}

// mergeMap processes all items concurrently - no waiting
const concurrentResults = mergeMap(requestIds, processRequest)
const mergeResults = await collect(concurrentResults)
console.log('Concurrent processing results:', mergeResults)
// Output: All requests processed concurrently, order may vary

// Example 5: Complex operator composition
console.log('\n--- Complex Operator Composition ---')

const dataStream = reactive([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

// Complex pipeline: filter -> transform -> accumulate -> flatten
const complexPipeline = dataStream.pipe(
  // Step 1: Filter even numbers
  map((arr: number[]) => arr.filter(n => n % 2 === 0)),
  
  // Step 2: Transform to objects
  map((arr: number[]) => arr.map(n => ({ value: n, squared: n * n }))),
  
  // Step 3: Accumulate with scan (emits intermediate states)
  scan((acc: any[], val: any[]) => [...acc, ...val], []),
  
  // Step 4: Flatten with concatMap for sequential processing
  concatMap((arr: any[]) => reactive([arr]))
)

const complexResults = await collect(complexPipeline)
console.log('Complex pipeline results:', complexResults)
// Output: Progressive accumulation of even number objects

// Example 6: Error handling with flattening
console.log('\n--- Error Handling with Flattening ---')

const taskIds = reactive(['task1', 'task2', 'task3'])

// Simulate tasks that might fail
const executeTask = (taskId: string) => {
  if (taskId === 'task2') {
    return reactive([taskId]).pipe(
      map(() => { throw new Error(`Task ${taskId} failed`) }),
      catchError((error: Error) => reactive([`Recovered from ${error.message}`]))
    )
  }
  return reactive([`Completed ${taskId}`])
}

// Handle errors in flattened streams
const resilientTasks = concatMap(taskIds, executeTask)
const resilientResults = await collect(resilientTasks)
console.log('Resilient task execution:', resilientResults)
// Output: All tasks completed, with error recovery for task2

// Example 7: Real-world search pattern
console.log('\n--- Real-world Search Pattern ---')

const searchInput = reactive('')

// Simulate search with debouncing and cancellation
const searchPattern = searchInput.pipe(
  // Filter out empty queries
  map((input: string) => input.trim()),
  filter((input: string) => input.length >= 2),
  
  // Debounce with delay
  concatMap((input: string) => reactive([input]).pipe(delay(300))),
  
  // Search API call with cancellation
  switchMap((query: string) => {
    console.log(`Searching for: ${query}`)
    return reactive([`Results for "${query}": item1, item2, item3`]).pipe(
      delay(100)
    )
  })
)

// Simulate user typing
searchInput.set('re')
searchInput.set('rea')
searchInput.set('react')
searchInput.set('react hooks')

const searchPatternResults = await collect(searchPattern)
console.log('Search pattern results:', searchPatternResults)
// Output: Only results from the last search due to switchMap cancellation

// Example 8: Data transformation pipeline
console.log('\n--- Data Transformation Pipeline ---')

const rawData = reactive([
  { id: 1, name: 'Alice', age: 25, active: true },
  { id: 2, name: 'Bob', age: 30, active: false },
  { id: 3, name: 'Charlie', age: 35, active: true },
  { id: 4, name: 'Diana', age: 28, active: true },
  { id: 5, name: 'Eve', age: 22, active: false }
])

// Complex data transformation pipeline
const dataPipeline = rawData.pipe(
  // Step 1: Filter active users
  map((users: any[]) => users.filter(user => user.active)),
  
  // Step 2: Transform to simplified format
  map((users: any[]) => users.map(user => ({
    id: user.id,
    displayName: `${user.name} (${user.age})`,
    ageGroup: user.age < 30 ? 'young' : 'adult'
  }))),
  
  // Step 3: Group by age group
  map((users: any[]) => {
    const groups = users.reduce((acc: any, user: any) => {
      if (!acc[user.ageGroup]) acc[user.ageGroup] = []
      acc[user.ageGroup].push(user)
      return acc
    }, {})
    return groups
  }),
  
  // Step 4: Accumulate results
  scan((acc: any, val: any) => ({ ...acc, ...val }), {})
)

const pipelineResults = await collect(dataPipeline)
console.log('Data pipeline results:', pipelineResults)
// Output: Progressive accumulation of grouped user data

console.log('\n=== Core Operators Examples Complete ===') 