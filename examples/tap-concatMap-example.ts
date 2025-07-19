import { reactive } from '../packages/engine/src/reactive'
import { tap } from '../packages/engine/src/operators'
import { concatMap } from '../packages/engine/src/operators'

console.log('=== Tap and ConcatMap Operator Examples ===')

// Example 1: Basic tap functionality
console.log('\n--- Tap Operator Examples ---')

const source = reactive(0)

// Basic side effect logging
const logged = tap(source, (value: number) => {
  console.log('Value passing through:', value)
})

const results: number[] = []
const unsub = logged.subscribe(val => results.push(val))

source.set(1)
source.set(2)
source.set(3)

console.log('Results:', results)
unsub()

// Example 2: Tap with external state
console.log('\n--- Tap with External State ---')

const stateSource = reactive(0)
let externalCounter = 0

const stateTracked = tap(stateSource, (value: number) => {
  externalCounter += value
  console.log('External counter updated:', externalCounter)
})

const stateUnsub = stateTracked.subscribe(() => {})

stateSource.set(5)
stateSource.set(10)
stateSource.set(15)

console.log('Final external counter:', externalCounter)
stateUnsub()

// Example 3: Tap for debugging
console.log('\n--- Tap for Debugging ---')

const debugSource = reactive('initial')

const debugged = tap(debugSource, (value: string) => {
  console.log('Debug - Value:', value, 'Type:', typeof value, 'Length:', value.length)
})

const debugUnsub = debugged.subscribe(() => {})

debugSource.set('hello')
debugSource.set('world')
debugSource.set('test')

debugUnsub()

// Example 4: Basic concatMap functionality
console.log('\n--- ConcatMap Operator Examples ---')

const concatSource = reactive(0)

// Create inner observables that emit and complete
const createInner = (value: number) => {
  const inner = reactive([] as number[])
  
  // Simulate async operations
  setTimeout(() => {
    inner.set([...inner.get(), value])
    console.log(`Inner ${value}: emitted ${value}`)
  }, 100)
  
  setTimeout(() => {
    inner.set([...inner.get(), value * 10])
    console.log(`Inner ${value}: emitted ${value * 10}`)
  }, 200)
  
  return inner
}

const concatenated = concatMap(concatSource, createInner)

const concatResults: number[] = []
const concatUnsub = concatenated.subscribe((values: number[]) => {
  concatResults.push(...values)
  console.log('ConcatMap result:', values)
})

concatSource.set(1)
concatSource.set(2)
concatSource.set(3)

// Simulate time passing
setTimeout(() => {
  console.log('Final concatMap results:', concatResults)
  concatUnsub()
}, 1000)

// Example 5: ConcatMap with different completion times
console.log('\n--- ConcatMap with Different Completion Times ---')

const timingSource = reactive(0)

const createTimedInner = (value: number) => {
  const inner = reactive([] as number[])
  
  // Different completion times based on value
  setTimeout(() => {
    inner.set([...inner.get(), value])
    console.log(`Timed inner ${value}: completed`)
  }, value * 100) // 100ms, 200ms, 300ms
  
  return inner
}

const timedConcat = concatMap(timingSource, createTimedInner)

const timedResults: number[] = []
const timedUnsub = timedConcat.subscribe((values: number[]) => {
  timedResults.push(...values)
  console.log('Timed concatMap result:', values)
})

// Emit in reverse order to test ordering
timingSource.set(3) // Will complete last (300ms)
timingSource.set(1) // Will complete first (100ms)
timingSource.set(2) // Will complete second (200ms)

setTimeout(() => {
  console.log('Final timed results:', timedResults)
  console.log('Order preserved:', timedResults.join(', '))
  timedUnsub()
}, 1000)

// Example 6: ConcatMap with API calls simulation
console.log('\n--- ConcatMap with API Calls Simulation ---')

const apiSource = reactive(0)

const simulateApiCall = (userId: number) => {
  const apiResult = reactive([] as any[])
  
  console.log(`Starting API call for user ${userId}`)
  
  setTimeout(() => {
    apiResult.set([...apiResult.get(), { userId, data: `User ${userId} data` }])
    console.log(`API call ${userId} completed`)
  }, 150)
  
  return apiResult
}

const apiConcat = concatMap(apiSource, simulateApiCall)

const apiResults: any[] = []
const apiUnsub = apiConcat.subscribe((values: any[]) => {
  apiResults.push(...values)
  console.log('API concatMap result:', values)
})

// Simulate sequential API calls
apiSource.set(1)
apiSource.set(2)
apiSource.set(3)

setTimeout(() => {
  console.log('Final API results:', apiResults)
  apiUnsub()
}, 1000)

// Example 7: Tap and ConcatMap together
console.log('\n--- Tap and ConcatMap Together ---')

const combinedSource = reactive(0)

const combinedTap = tap(combinedSource, (value: number) => {
  console.log('Source value before concatMap:', value)
})

const createCombinedInner = (value: number) => {
  const inner = reactive([] as number[])
  
  setTimeout(() => {
    inner.set([...inner.get(), value])
    console.log(`Combined inner ${value}: emitted`)
  }, 50)
  
  return inner
}

const combinedConcat = concatMap(combinedTap, createCombinedInner)

const combinedResults: number[] = []
const combinedUnsub = combinedConcat.subscribe((values: number[]) => {
  combinedResults.push(...values)
  console.log('Combined result:', values)
})

combinedSource.set(1)
combinedSource.set(2)

setTimeout(() => {
  console.log('Final combined results:', combinedResults)
  combinedUnsub()
}, 500)

// Example 8: Real-world patterns
console.log('\n--- Real-world Patterns ---')

// Pattern 1: Logging pipeline
console.log('Pattern 1: Logging pipeline')
const pipelineSource = reactive(0)

const loggedPipeline = tap(pipelineSource, (value: number) => {
  console.log('Pipeline input:', value)
})

const transformedPipeline = loggedPipeline.map((x: number) => x * 2)

const finalPipeline = tap(transformedPipeline, (value: number) => {
  console.log('Pipeline output:', value)
})

const pipelineUnsub = finalPipeline.subscribe(() => {})

pipelineSource.set(5)
pipelineSource.set(10)

pipelineUnsub()

// Pattern 2: Sequential file processing
console.log('\nPattern 2: Sequential file processing')
const fileSource = reactive('')

const processFile = (filename: string) => {
  const result = reactive([] as string[])
  
  console.log(`Processing file: ${filename}`)
  
  setTimeout(() => {
    result.set([...result.get(), `Processed: ${filename}`])
    console.log(`File ${filename} processed`)
  }, 100)
  
  return result
}

const fileConcat = concatMap(fileSource, processFile)

const fileResults: string[] = []
const fileUnsub = fileConcat.subscribe((values: string[]) => {
  fileResults.push(...values)
  console.log('File processing result:', values)
})

fileSource.set('file1.txt')
fileSource.set('file2.txt')
fileSource.set('file3.txt')

setTimeout(() => {
  console.log('All files processed:', fileResults)
  fileUnsub()
}, 500)

console.log('\nTap and ConcatMap examples completed!')
console.log('\nKey insights:')
console.log('- tap(): Perfect for logging, debugging, and side effects')
console.log('- concatMap(): Ideal for sequential operations like API calls')
console.log('- Both operators integrate well with the existing reactive system') 