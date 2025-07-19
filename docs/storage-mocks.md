# Storage Mock Implementations

## Overview

Our comprehensive IndexedDB and AsyncStorage mock implementations provide **realistic persistence simulation** for testing and development. These mocks simulate real storage behavior including latency, failures, quota limits, and network issues, ensuring your reactive database system works correctly when integrated with actual storage backends.

## Why Mock Storage?

### 1. **Confidence in Adapter Compatibility**
- Test your collection/storage layer before integrating with browser/device storage
- Verify reactive layer compatibility with persistence backends
- Ensure data flows correctly through the entire system

### 2. **Test Coverage of Persistence Logic**
- Verify data is stored and retrieved correctly
- Test that updates propagate properly through storage
- Ensure `liveQuery()` still reacts when backing store changes
- Validate transaction handling and error recovery

### 3. **Future-Proofing**
- Design your system to tolerate different storage backends
- Swap in actual IndexedDB or AsyncStorage with minimal code changes
- Reduce surprises when going from development to production

### 4. **Decoupled Architecture**
- Make your system more flexible, portable, and testable
- Support multiple storage backends (memory, IndexedDB, AsyncStorage)
- Enable cross-platform compatibility

## IndexedDB Mock

### Features

```typescript
import { createIndexedDBAdapter } from '../src/storage/indexeddb'

const indexedDB = createIndexedDBAdapter({
  dbName: 'my-app',
  storeName: 'data',
  maxSize: 50 * 1024 * 1024, // 50MB quota
  latency: 10, // 10ms latency
  failureRate: 0.05, // 5% failure rate
  debug: true
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dbName` | string | 'rxdb-mock' | Database name |
| `storeName` | string | 'data' | Object store name |
| `maxSize` | number | 50MB | Storage quota limit |
| `latency` | number | 10ms | Simulated operation latency |
| `failureRate` | number | 0 | Random failure rate (0-1) |
| `debug` | boolean | false | Enable debug logging |

### Usage Examples

#### Basic CRUD Operations

```typescript
await indexedDB.connect()

// Set and get data
await indexedDB.set('user:1', { id: 1, name: 'Alice' })
const user = await indexedDB.get('user:1')

// Delete data
await indexedDB.delete('user:1')

// Clear all data
await indexedDB.clear()
```

#### Collection Operations

```typescript
// Store collections
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
]
await indexedDB.setCollection('users', users)

// Retrieve collections
const retrievedUsers = await indexedDB.getCollection('users')

// Add to collection
await indexedDB.addToCollection('users', { id: 3, name: 'Charlie' })

// Update in collection
await indexedDB.updateInCollection('users', 1, { name: 'Alice Updated' })

// Remove from collection
await indexedDB.removeFromCollection('users', 2)
```

#### Query Operations

```typescript
// Query by single field
const activeUsers = await indexedDB.query('users', { active: true })

// Query by multiple fields
const userPosts = await indexedDB.query('posts', { 
  authorId: 1, 
  published: true 
})
```

#### Transaction Support

```typescript
const result = await indexedDB.transaction(async () => {
  await indexedDB.set('order:1', { id: 1, total: 100 })
  await indexedDB.set('order:2', { id: 2, total: 200 })
  return 'Transaction completed'
})
```

#### Event Handling

```typescript
indexedDB.addEventListener((event) => {
  console.log('Storage event:', event.type, event.key, event.data)
})

// Events are emitted for:
// - set: Data stored
// - delete: Data deleted
// - clear: All data cleared
// - collection-update: Collection modified
```

## AsyncStorage Mock

### Features

```typescript
import { createAsyncStorageAdapter } from '../src/storage/asyncstorage'

const asyncStorage = createAsyncStorageAdapter({
  prefix: '@myapp:',
  maxSize: 6 * 1024 * 1024, // 6MB (React Native limit)
  latency: 5, // 5ms latency
  failureRate: 0.03, // 3% failure rate
  simulateNetworkIssues: true,
  debug: true
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | string | '@rxdb:' | Key prefix for namespacing |
| `maxSize` | number | 6MB | Storage quota limit |
| `latency` | number | 5ms | Simulated operation latency |
| `failureRate` | number | 0 | Random failure rate (0-1) |
| `simulateNetworkIssues` | boolean | false | Enable network simulation |
| `debug` | boolean | false | Enable debug logging |

### Usage Examples

#### Basic CRUD Operations with Prefixing

```typescript
await asyncStorage.connect()

// Keys are automatically prefixed
await asyncStorage.set('user:1', { id: 1, name: 'Alice' })
// Actually stored as '@myapp:user:1'

const user = await asyncStorage.get('user:1')
await asyncStorage.delete('user:1')
await asyncStorage.clear()
```

#### Multi-Operations

```typescript
// Multi-set operation
await asyncStorage.multiSet([
  ['user:1', { id: 1, name: 'Alice' }],
  ['user:2', { id: 2, name: 'Bob' }],
  ['settings', { theme: 'dark' }]
])

// Multi-get operation
const results = await asyncStorage.multiGet(['user:1', 'user:2', 'settings'])

// Get all keys
const allKeys = await asyncStorage.getAllKeys()
```

#### Collection Operations

```typescript
const tasks = [
  { id: 1, title: 'Task 1', completed: false },
  { id: 2, title: 'Task 2', completed: true }
]

await asyncStorage.setCollection('tasks', tasks)
const retrievedTasks = await asyncStorage.getCollection('tasks')

await asyncStorage.addToCollection('tasks', { id: 3, title: 'Task 3' })
await asyncStorage.updateInCollection('tasks', 1, { completed: true })
await asyncStorage.removeFromCollection('tasks', 2)
```

#### Network Simulation

```typescript
// Simulate network outage
asyncStorage.setNetworkAvailable(false)
try {
  await asyncStorage.set('key', 'value')
} catch (error) {
  console.log('Network unavailable:', error.message)
}

// Restore network
asyncStorage.setNetworkAvailable(true)
await asyncStorage.set('key', 'value') // Now works
```

#### Reset Functionality

```typescript
// Reset all mock data for testing
asyncStorage.reset()
```

## Integration Examples

### Cross-Platform Storage Strategy

```typescript
import { createIndexedDBAdapter } from '../src/storage/indexeddb'
import { createAsyncStorageAdapter } from '../src/storage/asyncstorage'

// Choose storage based on environment
function createStorageAdapter() {
  if (typeof window !== 'undefined' && window.indexedDB) {
    // Browser environment
    return createIndexedDBAdapter({
      dbName: 'my-app',
      maxSize: 50 * 1024 * 1024
    })
  } else {
    // React Native environment
    return createAsyncStorageAdapter({
      prefix: '@myapp:',
      maxSize: 6 * 1024 * 1024
    })
  }
}

const storage = createStorageAdapter()
```

### Dual Storage for Redundancy

```typescript
const indexedDB = createIndexedDBAdapter({ dbName: 'primary' })
const asyncStorage = createAsyncStorageAdapter({ prefix: '@backup:' })

// Store in both for redundancy
async function storeData(key: string, data: any) {
  await Promise.all([
    indexedDB.set(key, data),
    asyncStorage.set(key, data)
  ])
}

// Read from primary, fallback to backup
async function getData(key: string) {
  try {
    return await indexedDB.get(key)
  } catch (error) {
    console.log('Primary storage failed, using backup')
    return await asyncStorage.get(key)
  }
}
```

### Testing with Realistic Scenarios

```typescript
// Test with realistic failure rates
const testStorage = createIndexedDBAdapter({
  failureRate: 0.1, // 10% failure rate
  latency: 20, // 20ms latency
  maxSize: 1024 * 1024 // 1MB quota
})

// Test error handling
let successCount = 0
let failureCount = 0

for (let i = 0; i < 100; i++) {
  try {
    await testStorage.set(`key${i}`, `value${i}`)
    successCount++
  } catch (error) {
    failureCount++
    console.log(`Operation ${i} failed:`, error.message)
  }
}

console.log(`Results: ${successCount} successes, ${failureCount} failures`)
```

## Error Handling

### Storage Error Types

```typescript
import { 
  StorageError, 
  ConnectionError, 
  TransactionError, 
  QuotaExceededError 
} from '../src/storage/types'

// Handle different error types
try {
  await storage.set('key', 'value')
} catch (error) {
  if (error instanceof ConnectionError) {
    console.log('Connection failed:', error.message)
  } else if (error instanceof QuotaExceededError) {
    console.log('Storage quota exceeded:', error.message)
  } else if (error instanceof TransactionError) {
    console.log('Transaction failed:', error.message)
  } else {
    console.log('Storage error:', error.message)
  }
}
```

### Retry Logic

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      console.log(`Attempt ${attempt} failed, retrying...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
  throw new Error('Max retries exceeded')
}

// Usage
const result = await retryOperation(() => storage.set('key', 'value'))
```

## Performance Considerations

### Latency Simulation

```typescript
// Realistic latency for different scenarios
const fastStorage = createIndexedDBAdapter({ latency: 5 }) // Fast SSD
const slowStorage = createIndexedDBAdapter({ latency: 50 }) // Slow HDD
const networkStorage = createAsyncStorageAdapter({ latency: 100 }) // Network storage
```

### Quota Management

```typescript
// Monitor storage usage
const stats = storage.getStats()
console.log(`Storage usage: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)

// Implement cleanup when approaching quota
if (stats.size > storage.options.maxSize * 0.9) {
  console.log('Storage quota nearly exceeded, cleaning up...')
  // Implement cleanup logic
}
```

## Best Practices

### 1. **Use Realistic Settings**
```typescript
// Development
const devStorage = createIndexedDBAdapter({
  failureRate: 0.05, // 5% failure rate
  latency: 10, // 10ms latency
  debug: true
})

// Production testing
const prodStorage = createIndexedDBAdapter({
  failureRate: 0.01, // 1% failure rate
  latency: 5, // 5ms latency
  debug: false
})
```

### 2. **Handle Failures Gracefully**
```typescript
async function safeStorageOperation<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    console.error('Storage operation failed:', error)
    // Implement fallback logic
    return null
  }
}
```

### 3. **Monitor Storage Events**
```typescript
storage.addEventListener((event) => {
  // Log storage events for debugging
  console.log('Storage event:', event)
  
  // Implement analytics
  analytics.track('storage_operation', {
    type: event.type,
    key: event.key,
    timestamp: event.timestamp
  })
})
```

### 4. **Test Edge Cases**
```typescript
// Test quota limits
const smallStorage = createIndexedDBAdapter({ maxSize: 100 })
await expect(smallStorage.set('large', 'x'.repeat(200)))
  .rejects.toThrow(QuotaExceededError)

// Test network issues
const networkStorage = createAsyncStorageAdapter({ 
  simulateNetworkIssues: true 
})
networkStorage.setNetworkAvailable(false)
await expect(networkStorage.set('key', 'value'))
  .rejects.toThrow(ConnectionError)
```

## Migration Strategy

### From Mock to Real Storage

```typescript
// Phase 1: Use mocks for development
const storage = createIndexedDBAdapter({
  failureRate: 0.1, // High failure rate for testing
  debug: true
})

// Phase 2: Reduce failure rate for integration testing
const storage = createIndexedDBAdapter({
  failureRate: 0.01, // Low failure rate
  debug: false
})

// Phase 3: Use real storage in production
// The same interface works with real IndexedDB/AsyncStorage
```

This comprehensive mock system provides **realistic persistence simulation** while maintaining the same interface as real storage backends, enabling confident development and testing of your reactive database system. 