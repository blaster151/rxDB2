import { getDiagnostics, trackSubscriber, trackOperator, trackLiveQuery, recordOperation } from '../packages/engine/src/devtools/diagnostics.js'

console.log('=== Simple DevTools Diagnostics Example ===\n')

// Start diagnostics monitoring
const diagnostics = getDiagnostics()

// Subscribe to diagnostics updates
const unsubscribeDiagnostics = diagnostics.subscribe(snapshot => {
  console.log('\n📊 DIAGNOSTICS SNAPSHOT:', new Date().toLocaleTimeString())
  console.log('=' * 50)
  
  // System metrics
  console.log(`💾 Memory: ${snapshot.system.memory.collections} collections, ${snapshot.system.memory.subscribers} subscribers`)
  console.log(`⚡ Performance: ${snapshot.system.performance.totalOperations} ops, ${(snapshot.system.performance.errorRate * 100).toFixed(1)}% error rate`)
  console.log(`⏱️  Uptime: ${Math.round(snapshot.system.uptime.duration / 1000)}s`)
  
  // Active items
  console.log(`👥 Active Subscribers: ${snapshot.subscribers.filter(s => s.active).length}`)
  console.log(`⚙️  Active Operators: ${snapshot.operators.filter(o => o.active).length}`)
  console.log(`🔍 Active Live Queries: ${snapshot.liveQueries.filter(q => q.active).length}`)
})

// Example 1: Track some subscribers
console.log('1. Tracking subscribers...')
trackSubscriber('test-sub-1', 'custom', 'example-subscriber-1')
trackSubscriber('test-sub-2', 'custom', 'example-subscriber-2')

// Example 2: Track some operators
console.log('\n2. Tracking operators...')
trackOperator('test-op-1', 'map', 'data → processed')
trackOperator('test-op-2', 'filter', 'processed → filtered')

// Example 3: Track some live queries
console.log('\n3. Tracking live queries...')
trackLiveQuery('test-query-1', 'users', 'active = true')
trackLiveQuery('test-query-2', 'posts', 'published = true')

// Example 4: Record some operations
console.log('\n4. Recording operations...')
recordOperation(50, false)  // 50ms, success
recordOperation(100, false) // 100ms, success
recordOperation(75, true)   // 75ms, error

// Example 5: Simulate activity
console.log('\n5. Simulating activity...')

let activityCounter = 0
const activityInterval = setInterval(() => {
  activityCounter++
  
  // Record some operations
  recordOperation(Math.random() * 50 + 10)
  
  // Stop after 5 seconds
  if (activityCounter >= 5) {
    clearInterval(activityInterval)
    console.log('\n✅ Diagnostics monitoring complete!')
    
    // Cleanup
    setTimeout(() => {
      unsubscribeDiagnostics()
      console.log('🔧 Diagnostics monitoring stopped.')
    }, 2000)
  }
}, 1000)

console.log('\n🎯 DevTools Diagnostics Features Demonstrated:')
console.log('✅ Real-time system monitoring')
console.log('✅ Subscriber activity tracking')
console.log('✅ Operator performance metrics')
console.log('✅ Live query execution metrics')
console.log('✅ System performance monitoring')
console.log('✅ Error rate tracking')
console.log('✅ Memory usage statistics')
console.log('✅ Automatic cleanup of inactive entries') 