import { defineCollection } from '../packages/engine/src/database/defineCollection.js'
import { reactive } from '../packages/engine/src/reactive.js'
import { map, filter, scan } from '../packages/engine/src/operators.js'
import { getDiagnostics, trackSubscriber, trackOperator, trackLiveQuery, recordOperation } from '../packages/engine/src/devtools/diagnostics.js'
import { z } from 'zod'

// Define a user schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0),
  isActive: z.boolean()
})

type User = z.infer<typeof UserSchema>

// Create collections
const users = defineCollection<User>('users', UserSchema)
const posts = defineCollection<{ id: string; userId: string; title: string; content: string }>('posts', z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  content: z.string()
}))

console.log('=== DevTools Diagnostics Example ===\n')

// Start diagnostics monitoring
const diagnostics = getDiagnostics()

// Subscribe to diagnostics updates
const unsubscribeDiagnostics = diagnostics.subscribe(snapshot => {
  console.log('\n📊 DIAGNOSTICS SNAPSHOT:', new Date().toLocaleTimeString())
  console.log('=' * 50)
  
  // Collections
  console.log(`📚 Collections: ${snapshot.collections.length}`)
  snapshot.collections.forEach(collection => {
    console.log(`  - ${collection.name}: ${collection.state} (${collection.count} items)`)
  })
  
  // Subscribers
  console.log(`👥 Active Subscribers: ${snapshot.subscribers.filter(s => s.active).length}`)
  snapshot.subscribers.filter(s => s.active).forEach(sub => {
    console.log(`  - ${sub.type}: ${sub.source} (${sub.id})`)
  })
  
  // Operators
  console.log(`⚙️  Active Operators: ${snapshot.operators.filter(o => o.active).length}`)
  snapshot.operators.filter(o => o.active).forEach(op => {
    console.log(`  - ${op.type}: ${op.source} (${op.inputCount} → ${op.outputCount})`)
  })
  
  // Live Queries
  console.log(`🔍 Active Live Queries: ${snapshot.liveQueries.filter(q => q.active).length}`)
  snapshot.liveQueries.filter(q => q.active).forEach(query => {
    console.log(`  - ${query.collection}: ${query.resultCount} results`)
  })
  
  // System metrics
  console.log(`💾 Memory: ${snapshot.system.memory.collections} collections, ${snapshot.system.memory.subscribers} subscribers`)
  console.log(`⚡ Performance: ${snapshot.system.performance.totalOperations} ops, ${(snapshot.system.performance.errorRate * 100).toFixed(1)}% error rate`)
  console.log(`⏱️  Uptime: ${Math.round(snapshot.system.uptime.duration / 1000)}s`)
})

// Example 1: Track collection operations
console.log('1. Adding users to collection...')
const startTime = Date.now()

users.insert({ id: '1', name: 'Alice', email: 'alice@example.com', age: 25, isActive: true })
users.insert({ id: '2', name: 'Bob', email: 'bob@example.com', age: 30, isActive: false })
users.insert({ id: '3', name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: true })

recordOperation(Date.now() - startTime)

// Example 2: Track reactive subscribers
console.log('\n2. Creating reactive subscribers...')

const userCount = reactive(users.count)
trackSubscriber('user-count', 'collection', 'users.count')

const activeUsers = reactive(users.find({ isActive: true }))
trackSubscriber('active-users', 'liveQuery', 'users.find({isActive: true})')

// Example 3: Track operator chains
console.log('\n3. Creating operator chains...')

const userNames = map(activeUsers, users => users.map(u => u.name))
trackOperator('user-names', 'map', 'activeUsers → names')

const longNames = filter(userNames, names => names.some(name => name.length > 5))
trackOperator('long-names', 'filter', 'userNames → long names')

const nameStats = scan(longNames, (acc, names) => {
  return {
    count: names.length,
    totalLength: names.reduce((sum, name) => sum + name.length, 0),
    averageLength: names.length > 0 ? names.reduce((sum, name) => sum + name.length, 0) / names.length : 0
  }
}, { count: 0, totalLength: 0, averageLength: 0 })
trackOperator('name-stats', 'scan', 'longNames → statistics')

// Example 4: Track live queries
console.log('\n4. Setting up live queries...')

trackLiveQuery('users-by-age', 'users', 'age > 25')
trackLiveQuery('active-users-count', 'users', 'isActive = true')

// Example 5: Simulate real-time activity
console.log('\n5. Simulating real-time activity...')

let activityCounter = 0
const activityInterval = setInterval(() => {
  activityCounter++
  
  // Update some reactive values
  userCount.set(users.count)
  
  // Record some operations
  recordOperation(Math.random() * 10)
  
  // Update operator activity
  if (activityCounter % 3 === 0) {
    const newUser = { 
      id: `user-${activityCounter}`, 
      name: `User${activityCounter}`, 
      email: `user${activityCounter}@example.com`, 
      age: 20 + (activityCounter % 40), 
      isActive: Math.random() > 0.5 
    }
    users.insert(newUser)
  }
  
  // Stop after 10 seconds
  if (activityCounter >= 10) {
    clearInterval(activityInterval)
    console.log('\n✅ Diagnostics monitoring complete!')
    console.log('Check the output above to see real-time diagnostics.')
    
    // Cleanup
    setTimeout(() => {
      unsubscribeDiagnostics()
      console.log('🔧 Diagnostics monitoring stopped.')
    }, 2000)
  }
}, 1000)

// Example 6: Error tracking
console.log('\n6. Demonstrating error tracking...')

try {
  // This will cause a validation error
  users.insert({ id: 'invalid', name: '', email: 'invalid-email', age: -5, isActive: true } as any)
} catch (error) {
  recordOperation(undefined, true) // Record error
  console.log('❌ Caught validation error (expected)')
}

// Example 7: Performance monitoring
console.log('\n7. Performance monitoring...')

const performanceTest = () => {
  const start = Date.now()
  
  // Simulate expensive operation
  const results = users.find({ isActive: true })
  const processed = results.map(u => ({ ...u, processed: true }))
  
  const duration = Date.now() - start
  recordOperation(duration)
  
  return processed
}

// Run performance test
performanceTest()

console.log('\n🎯 DevTools Diagnostics Features Demonstrated:')
console.log('✅ Real-time collection monitoring')
console.log('✅ Subscriber activity tracking')
console.log('✅ Operator chain performance')
console.log('✅ Live query execution metrics')
console.log('✅ System performance monitoring')
console.log('✅ Error rate tracking')
console.log('✅ Memory usage statistics')
console.log('✅ Automatic cleanup of inactive entries')

console.log('\n📈 The diagnostics stream updates every second with:')
console.log('- Current state of all collections')
console.log('- Active subscribers and their activity')
console.log('- Operator performance metrics')
console.log('- Live query execution times')
console.log('- System-wide performance statistics')
console.log('- Memory usage and error rates') 