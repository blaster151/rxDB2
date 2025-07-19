# DevTools Diagnostics

The DevTools diagnostics system provides real-time introspection into rxDB2's internal state, including collections, subscribers, operators, and live queries. This is essential for debugging, performance monitoring, and understanding your application's reactive data flow.

## Features

- ✅ **Real-time Monitoring**: Live snapshots of system state
- ✅ **Collection Tracking**: Monitor collection states, counts, and readiness
- ✅ **Subscriber Analytics**: Track active subscribers and their activity
- ✅ **Operator Performance**: Monitor operator chains and their metrics
- ✅ **Live Query Metrics**: Track query execution times and result counts
- ✅ **System Performance**: Overall performance and error rate monitoring
- ✅ **Memory Management**: Automatic cleanup of inactive entries
- ✅ **Observable API**: Subscribe to diagnostics updates

## Quick Start

```typescript
import { getDiagnostics } from '@rxdb2/engine'

// Get the diagnostics stream
const diagnostics = getDiagnostics()

// Subscribe to real-time updates
const unsubscribe = diagnostics.subscribe(snapshot => {
  console.log('📊 System State:', snapshot)
  console.log(`Collections: ${snapshot.collections.length}`)
  console.log(`Active Subscribers: ${snapshot.subscribers.filter(s => s.active).length}`)
  console.log(`Active Operators: ${snapshot.operators.filter(o => o.active).length}`)
})

// Later, unsubscribe to stop monitoring
unsubscribe()
```

## API Reference

### `getDiagnostics(): Observable<DiagnosticsSnapshot>`

Returns an observable stream that emits diagnostic snapshots every second.

```typescript
interface DiagnosticsSnapshot {
  collections: CollectionDiagnostics[]
  subscribers: SubscriberDiagnostics[]
  operators: OperatorDiagnostics[]
  liveQueries: LiveQueryDiagnostics[]
  system: SystemDiagnostics
  timestamp: Date
}
```

### Manual Tracking Functions

#### `trackSubscriber(id: string, source: string, metadata?: Record<string, any>): void`

Manually track a subscriber for debugging purposes.

```typescript
import { trackSubscriber } from '@rxdb2/engine'

// Track a custom subscriber
trackSubscriber('user-count', 'collection', { 
  description: 'User count display component',
  component: 'UserDashboard'
})
```

#### `trackOperator(id: string, type: OperatorType, source: string, metadata?: Record<string, any>): void`

Track an operator in your reactive chain.

```typescript
import { trackOperator } from '@rxdb2/engine'

const processedData = map(rawData, processItem)
trackOperator('data-processor', 'map', 'rawData → processedData', {
  transformation: 'processItem',
  complexity: 'O(n)'
})
```

#### `trackLiveQuery(id: string, collection: string, filter?: string): void`

Track a live query for performance monitoring.

```typescript
import { trackLiveQuery } from '@rxdb2/engine'

const activeUsers = users.find({ isActive: true })
trackLiveQuery('active-users', 'users', 'isActive = true')
```

#### `recordOperation(executionTime?: number, error?: boolean): void`

Record operation performance metrics.

```typescript
import { recordOperation } from '@rxdb2/engine'

const startTime = Date.now()
try {
  // Perform operation
  const result = expensiveOperation()
  recordOperation(Date.now() - startTime, false)
} catch (error) {
  recordOperation(Date.now() - startTime, true)
}
```

## Diagnostic Types

### CollectionDiagnostics

```typescript
interface CollectionDiagnostics {
  name: string
  state: CollectionState // 'initializing' | 'ready' | 'error' | 'disconnected'
  count: number
  schema: string
  lastActivity?: Date
  error?: string
}
```

### SubscriberDiagnostics

```typescript
interface SubscriberDiagnostics {
  id: string
  type: 'collection' | 'operator' | 'liveQuery' | 'custom'
  source: string
  active: boolean
  createdAt: Date
  lastActivity?: Date
  metadata?: Record<string, any>
}
```

### OperatorDiagnostics

```typescript
interface OperatorDiagnostics {
  id: string
  type: 'map' | 'filter' | 'scan' | 'mergeMap' | 'switchMap' | 'concatMap' | 'share' | 'multicast' | 'custom'
  source: string
  active: boolean
  createdAt: Date
  lastActivity?: Date
  inputCount: number
  outputCount: number
  errorCount: number
  metadata?: Record<string, any>
}
```

### LiveQueryDiagnostics

```typescript
interface LiveQueryDiagnostics {
  id: string
  collection: string
  filter?: string
  active: boolean
  createdAt: Date
  lastActivity?: Date
  resultCount: number
  executionTime?: number
}
```

### SystemDiagnostics

```typescript
interface SystemDiagnostics {
  memory: {
    collections: number
    subscribers: number
    operators: number
    liveQueries: number
  }
  performance: {
    averageQueryTime: number
    totalOperations: number
    errorRate: number
  }
  uptime: {
    startTime: Date
    currentTime: Date
    duration: number
  }
}
```

## Use Cases

### 1. Performance Monitoring

```typescript
const diagnostics = getDiagnostics()

diagnostics.subscribe(snapshot => {
  // Monitor performance metrics
  if (snapshot.system.performance.errorRate > 0.1) {
    console.warn('High error rate detected:', snapshot.system.performance.errorRate)
  }
  
  if (snapshot.system.performance.averageQueryTime > 100) {
    console.warn('Slow queries detected:', snapshot.system.performance.averageQueryTime + 'ms')
  }
})
```

### 2. Memory Leak Detection

```typescript
const diagnostics = getDiagnostics()

diagnostics.subscribe(snapshot => {
  // Monitor subscriber count
  const activeSubscribers = snapshot.subscribers.filter(s => s.active).length
  
  if (activeSubscribers > 1000) {
    console.error('Potential memory leak: too many active subscribers:', activeSubscribers)
  }
  
  // Monitor operator count
  const activeOperators = snapshot.operators.filter(o => o.active).length
  
  if (activeOperators > 500) {
    console.error('Potential memory leak: too many active operators:', activeOperators)
  }
})
```

### 3. Debugging Reactive Chains

```typescript
// Track your operator chain
const data = reactive([1, 2, 3, 4, 5])

const doubled = map(data, x => x * 2)
trackOperator('double', 'map', 'data → doubled')

const evens = filter(doubled, x => x % 2 === 0)
trackOperator('even-filter', 'filter', 'doubled → evens')

const sum = scan(evens, (acc, val) => acc + val, 0)
trackOperator('sum', 'scan', 'evens → sum')

// Monitor the chain
const diagnostics = getDiagnostics()
diagnostics.subscribe(snapshot => {
  const operators = snapshot.operators.filter(o => o.active)
  console.log('Active operators:', operators.map(o => `${o.type}: ${o.source}`))
})
```

### 4. Collection Health Monitoring

```typescript
const diagnostics = getDiagnostics()

diagnostics.subscribe(snapshot => {
  snapshot.collections.forEach(collection => {
    if (collection.state === 'error') {
      console.error(`Collection ${collection.name} is in error state:`, collection.error)
    }
    
    if (collection.state === 'disconnected') {
      console.warn(`Collection ${collection.name} is disconnected`)
    }
  })
})
```

### 5. Live Query Performance

```typescript
const diagnostics = getDiagnostics()

diagnostics.subscribe(snapshot => {
  snapshot.liveQueries.forEach(query => {
    if (query.executionTime && query.executionTime > 50) {
      console.warn(`Slow live query: ${query.collection} (${query.executionTime}ms)`)
    }
    
    if (query.resultCount > 1000) {
      console.warn(`Large result set: ${query.collection} (${query.resultCount} results)`)
    }
  })
})
```

## Advanced Usage

### Custom Diagnostic Observables

```typescript
import { createDiagnosticObservable } from '@rxdb2/engine'

// Create an observable with built-in diagnostics
const diagnosticData = createDiagnosticObservable(
  initialValue,
  'my-data-stream',
  'subscriber',
  'user-input-processing',
  { priority: 'high', component: 'DataProcessor' }
)
```

### Performance Profiling

```typescript
// Profile a specific operation
const profileOperation = (name: string, operation: () => void) => {
  const startTime = Date.now()
  let error = false
  
  try {
    operation()
  } catch (e) {
    error = true
    throw e
  } finally {
    const duration = Date.now() - startTime
    recordOperation(duration, error)
    
    console.log(`Operation ${name}: ${duration}ms ${error ? '(error)' : '(success)'}`)
  }
}

// Usage
profileOperation('user-insert', () => {
  users.insert(newUser)
})
```

### Automatic Cleanup

The diagnostics system automatically cleans up inactive entries after 5 minutes. You can customize this:

```typescript
import { diagnosticsRegistry } from '@rxdb2/engine'

// Clean up entries older than 1 minute
diagnosticsRegistry.cleanup(60 * 1000)

// Clean up entries older than 1 hour
diagnosticsRegistry.cleanup(60 * 60 * 1000)
```

## Integration with DevTools

### Browser DevTools Extension

```typescript
// Expose diagnostics to window for browser DevTools
if (typeof window !== 'undefined') {
  const diagnostics = getDiagnostics()
  
  // Update window object with latest diagnostics
  diagnostics.subscribe(snapshot => {
    (window as any).__rxdb2Diagnostics = snapshot
  })
  
  // Add helper functions
  (window as any).__rxdb2Helpers = {
    getDiagnostics: () => (window as any).__rxdb2Diagnostics,
    trackSubscriber,
    trackOperator,
    trackLiveQuery,
    recordOperation
  }
}
```

### Node.js Monitoring

```typescript
// For Node.js applications
const diagnostics = getDiagnostics()

diagnostics.subscribe(snapshot => {
  // Log to monitoring service
  console.log(JSON.stringify({
    timestamp: snapshot.timestamp.toISOString(),
    metrics: {
      collections: snapshot.system.memory.collections,
      subscribers: snapshot.system.memory.subscribers,
      operators: snapshot.system.memory.operators,
      liveQueries: snapshot.system.memory.liveQueries,
      errorRate: snapshot.system.performance.errorRate,
      averageQueryTime: snapshot.system.performance.averageQueryTime
    }
  }))
})
```

## Best Practices

### 1. Use Meaningful IDs

```typescript
// Good: Descriptive IDs
trackSubscriber('user-dashboard-count', 'collection', 'users.count')
trackOperator('user-name-uppercase', 'map', 'users → uppercase names')

// Bad: Generic IDs
trackSubscriber('sub1', 'collection', 'data')
trackOperator('op1', 'map', 'transform')
```

### 2. Include Relevant Metadata

```typescript
trackSubscriber('user-list', 'liveQuery', 'users.find({active: true})', {
  component: 'UserList',
  page: 'dashboard',
  priority: 'high'
})
```

### 3. Monitor in Development Only

```typescript
if (process.env.NODE_ENV === 'development') {
  const diagnostics = getDiagnostics()
  diagnostics.subscribe(snapshot => {
    // Development-only monitoring
    console.log('Dev Diagnostics:', snapshot)
  })
}
```

### 4. Set Up Alerts

```typescript
const diagnostics = getDiagnostics()

diagnostics.subscribe(snapshot => {
  // Alert on high error rates
  if (snapshot.system.performance.errorRate > 0.05) {
    // Send alert to monitoring service
    alertMonitoringService('High error rate detected', snapshot)
  }
  
  // Alert on memory issues
  if (snapshot.system.memory.subscribers > 1000) {
    alertMonitoringService('Too many subscribers', snapshot)
  }
})
```

## Troubleshooting

### Common Issues

1. **High Subscriber Count**: Check for unsubscribed subscriptions
2. **High Error Rate**: Review validation and error handling
3. **Slow Queries**: Optimize collection queries and filters
4. **Memory Leaks**: Ensure proper cleanup of subscriptions

### Debug Commands

```typescript
// Get current diagnostics in console
console.log('Current Diagnostics:', (window as any).__rxdb2Diagnostics)

// Track specific operation
(window as any).__rxdb2Helpers.trackSubscriber('debug-sub', 'custom', 'debug')

// Record operation timing
(window as any).__rxdb2Helpers.recordOperation(100, false)
```

The DevTools diagnostics system provides comprehensive visibility into rxDB2's internal state, making it easier to debug, optimize, and monitor your reactive applications. 