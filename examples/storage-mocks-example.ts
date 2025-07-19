import { createIndexedDBAdapter } from '../src/storage/indexeddb'
import { createAsyncStorageAdapter } from '../src/storage/asyncstorage'

console.log('=== Storage Mock Implementations Demo ===')

async function demonstrateIndexedDBMock() {
  console.log('\n--- IndexedDB Mock Demonstration ---')

  // Create IndexedDB adapter with realistic settings
  const indexedDB = createIndexedDBAdapter({
    dbName: 'demo-db',
    storeName: 'data',
    maxSize: 10 * 1024 * 1024, // 10MB
    latency: 15, // 15ms latency
    failureRate: 0.05, // 5% failure rate
    debug: true
  })

  try {
    // Connect to storage
    console.log('Connecting to IndexedDB...')
    await indexedDB.connect()
    console.log('✅ Connected to IndexedDB')

    // Basic CRUD operations
    console.log('\n--- Basic CRUD Operations ---')
    
    await indexedDB.set('user:1', {
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      preferences: {
        theme: 'dark',
        notifications: true
      }
    })
    console.log('✅ Set user data')

    const user = await indexedDB.get('user:1')
    console.log('✅ Retrieved user:', user?.name)

    // Collection operations
    console.log('\n--- Collection Operations ---')
    
    const products = [
      { id: 1, name: 'Laptop', price: 999.99, category: 'electronics' },
      { id: 2, name: 'Phone', price: 599.99, category: 'electronics' },
      { id: 3, name: 'Book', price: 19.99, category: 'books' }
    ]

    await indexedDB.setCollection('products', products)
    console.log('✅ Set products collection')

    const retrievedProducts = await indexedDB.getCollection('products')
    console.log(`✅ Retrieved ${retrievedProducts.length} products`)

    // Add to collection
    await indexedDB.addToCollection('products', {
      id: 4,
      name: 'Tablet',
      price: 399.99,
      category: 'electronics'
    })
    console.log('✅ Added tablet to products')

    // Update in collection
    await indexedDB.updateInCollection('products', 1, { price: 1099.99 })
    console.log('✅ Updated laptop price')

    // Query operations
    console.log('\n--- Query Operations ---')
    
    const electronics = await indexedDB.query('products', { category: 'electronics' })
    console.log(`✅ Found ${electronics.length} electronics products`)

    const expensiveProducts = await indexedDB.query('products', { price: 1099.99 })
    console.log(`✅ Found ${expensiveProducts.length} products with price 1099.99`)

    // Transaction operations
    console.log('\n--- Transaction Operations ---')
    
    const result = await indexedDB.transaction(async () => {
      await indexedDB.set('order:1', { id: 1, total: 1500 })
      await indexedDB.set('order:2', { id: 2, total: 800 })
      return 'Transaction completed successfully'
    })
    console.log('✅', result)

    // Get statistics
    const stats = indexedDB.getStats()
    console.log('\n--- Storage Statistics ---')
    console.log(`Total keys: ${stats.totalKeys}`)
    console.log(`Total collections: ${stats.totalCollections}`)
    console.log(`Total items: ${stats.totalItems}`)
    console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`)
    console.log(`Last modified: ${stats.lastModified.toLocaleString()}`)

    // Event handling
    console.log('\n--- Event Handling ---')
    
    indexedDB.addEventListener((event) => {
      console.log(`📡 Storage event: ${event.type}`, {
        key: event.key,
        collectionName: event.collectionName,
        timestamp: new Date(event.timestamp).toLocaleTimeString()
      })
    })

    // Trigger some events
    await indexedDB.set('test:event', 'trigger event')
    await indexedDB.delete('test:event')
    await indexedDB.setCollection('test', [{ id: 1, name: 'test' }])

    // Disconnect
    await indexedDB.disconnect()
    console.log('✅ Disconnected from IndexedDB')

  } catch (error) {
    console.error('❌ IndexedDB error:', error)
  }
}

async function demonstrateAsyncStorageMock() {
  console.log('\n--- AsyncStorage Mock Demonstration ---')

  // Create AsyncStorage adapter with realistic settings
  const asyncStorage = createAsyncStorageAdapter({
    prefix: '@demo:',
    maxSize: 6 * 1024 * 1024, // 6MB (React Native limit)
    latency: 8, // 8ms latency
    failureRate: 0.03, // 3% failure rate
    simulateNetworkIssues: true,
    debug: true
  })

  try {
    // Connect to storage
    console.log('Connecting to AsyncStorage...')
    await asyncStorage.connect()
    console.log('✅ Connected to AsyncStorage')

    // Basic CRUD operations with prefixing
    console.log('\n--- Basic CRUD Operations (with prefixing) ---')
    
    await asyncStorage.set('user:1', {
      id: 1,
      name: 'Bob Smith',
      email: 'bob@example.com',
      settings: {
        language: 'en',
        timezone: 'UTC'
      }
    })
    console.log('✅ Set user data (prefixed)')

    const user = await asyncStorage.get('user:1')
    console.log('✅ Retrieved user:', user?.name)

    // Multi-get and multi-set operations
    console.log('\n--- Multi-Operations ---')
    
    await asyncStorage.multiSet([
      ['user:2', { id: 2, name: 'Charlie Brown', email: 'charlie@example.com' }],
      ['user:3', { id: 3, name: 'Diana Prince', email: 'diana@example.com' }],
      ['settings:global', { theme: 'light', notifications: false }]
    ])
    console.log('✅ Multi-set completed')

    const multiResults = await asyncStorage.multiGet(['user:2', 'user:3', 'settings:global'])
    console.log(`✅ Multi-get retrieved ${multiResults.length} items`)

    // Get all keys
    const allKeys = await asyncStorage.getAllKeys()
    console.log(`✅ All keys (${allKeys.length}):`, allKeys)

    // Collection operations
    console.log('\n--- Collection Operations ---')
    
    const tasks = [
      { id: 1, title: 'Complete project', completed: false, priority: 'high' },
      { id: 2, title: 'Review code', completed: true, priority: 'medium' },
      { id: 3, title: 'Write tests', completed: false, priority: 'high' }
    ]

    await asyncStorage.setCollection('tasks', tasks)
    console.log('✅ Set tasks collection')

    const retrievedTasks = await asyncStorage.getCollection('tasks')
    console.log(`✅ Retrieved ${retrievedTasks.length} tasks`)

    // Add to collection
    await asyncStorage.addToCollection('tasks', {
      id: 4,
      title: 'Deploy to production',
      completed: false,
      priority: 'critical'
    })
    console.log('✅ Added deployment task')

    // Update in collection
    await asyncStorage.updateInCollection('tasks', 1, { completed: true })
    console.log('✅ Marked project as completed')

    // Query operations
    console.log('\n--- Query Operations ---')
    
    const highPriorityTasks = await asyncStorage.query('tasks', { priority: 'high' })
    console.log(`✅ Found ${highPriorityTasks.length} high priority tasks`)

    const completedTasks = await asyncStorage.query('tasks', { completed: true })
    console.log(`✅ Found ${completedTasks.length} completed tasks`)

    // Network simulation
    console.log('\n--- Network Simulation ---')
    
    console.log('Simulating network outage...')
    asyncStorage.setNetworkAvailable(false)
    
    try {
      await asyncStorage.set('test:network', 'should fail')
    } catch (error) {
      console.log('✅ Correctly caught network error:', error.message)
    }

    console.log('Restoring network...')
    asyncStorage.setNetworkAvailable(true)
    
    await asyncStorage.set('test:network', 'should work now')
    console.log('✅ Network restored, operation succeeded')

    // Get statistics
    const stats = asyncStorage.getStats()
    console.log('\n--- Storage Statistics ---')
    console.log(`Total keys: ${stats.totalKeys}`)
    console.log(`Total collections: ${stats.totalCollections}`)
    console.log(`Total items: ${stats.totalItems}`)
    console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`)
    console.log(`Last modified: ${stats.lastModified.toLocaleString()}`)

    // Event handling
    console.log('\n--- Event Handling ---')
    
    asyncStorage.addEventListener((event) => {
      console.log(`📡 Storage event: ${event.type}`, {
        key: event.key,
        collectionName: event.collectionName,
        timestamp: new Date(event.timestamp).toLocaleTimeString()
      })
    })

    // Trigger some events
    await asyncStorage.set('test:event', 'trigger event')
    await asyncStorage.delete('test:event')
    await asyncStorage.setCollection('test', [{ id: 1, name: 'test' }])

    // Reset for testing
    console.log('\n--- Reset Functionality ---')
    console.log('Before reset:', await asyncStorage.getCollection('tasks'))
    asyncStorage.reset()
    console.log('After reset:', await asyncStorage.getCollection('tasks'))

    // Disconnect
    await asyncStorage.disconnect()
    console.log('✅ Disconnected from AsyncStorage')

  } catch (error) {
    console.error('❌ AsyncStorage error:', error)
  }
}

async function demonstrateIntegration() {
  console.log('\n--- Integration Demonstration ---')

  // Create both adapters
  const indexedDB = createIndexedDBAdapter({
    dbName: 'integration-db',
    latency: 10,
    failureRate: 0.02,
    debug: true
  })

  const asyncStorage = createAsyncStorageAdapter({
    prefix: '@integration:',
    latency: 5,
    failureRate: 0.01,
    debug: true
  })

  try {
    // Connect to both
    await Promise.all([
      indexedDB.connect(),
      asyncStorage.connect()
    ])
    console.log('✅ Connected to both storage systems')

    // Simulate realistic application data
    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com', active: true, lastLogin: new Date() },
      { id: 2, name: 'Bob', email: 'bob@example.com', active: false, lastLogin: new Date() },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', active: true, lastLogin: new Date() }
    ]

    const posts = [
      { id: 1, title: 'Getting Started', content: 'Welcome to our platform', authorId: 1, published: true },
      { id: 2, title: 'Advanced Features', content: 'Learn about advanced features', authorId: 2, published: false },
      { id: 3, title: 'Best Practices', content: 'Follow these best practices', authorId: 1, published: true }
    ]

    // Store data in both systems
    console.log('\n--- Storing Data in Both Systems ---')
    
    await Promise.all([
      indexedDB.setCollection('users', users),
      indexedDB.setCollection('posts', posts),
      asyncStorage.setCollection('users', users),
      asyncStorage.setCollection('posts', posts)
    ])
    console.log('✅ Data stored in both systems')

    // Query from both systems
    console.log('\n--- Querying from Both Systems ---')
    
    const [indexedDBUsers, asyncStorageUsers] = await Promise.all([
      indexedDB.query('users', { active: true }),
      asyncStorage.query('users', { active: true })
    ])

    console.log(`IndexedDB active users: ${indexedDBUsers.length}`)
    console.log(`AsyncStorage active users: ${asyncStorageUsers.length}`)

    const [indexedDBPosts, asyncStoragePosts] = await Promise.all([
      indexedDB.query('posts', { published: true }),
      asyncStorage.query('posts', { published: true })
    ])

    console.log(`IndexedDB published posts: ${indexedDBPosts.length}`)
    console.log(`AsyncStorage published posts: ${asyncStoragePosts.length}`)

    // Update data in both systems
    console.log('\n--- Updating Data in Both Systems ---')
    
    await Promise.all([
      indexedDB.updateInCollection('users', 1, { name: 'Alice Updated' }),
      asyncStorage.updateInCollection('users', 1, { name: 'Alice Updated' })
    ])
    console.log('✅ Updated user in both systems')

    // Verify updates
    const [updatedIndexedDB, updatedAsyncStorage] = await Promise.all([
      indexedDB.getCollection('users'),
      asyncStorage.getCollection('users')
    ])

    console.log('IndexedDB updated user:', updatedIndexedDB[0].name)
    console.log('AsyncStorage updated user:', updatedAsyncStorage[0].name)

    // Compare statistics
    console.log('\n--- Statistics Comparison ---')
    
    const [indexedDBStats, asyncStorageStats] = await Promise.all([
      indexedDB.getStats(),
      asyncStorage.getStats()
    ])

    console.log('IndexedDB Stats:', {
      totalKeys: indexedDBStats.totalKeys,
      totalCollections: indexedDBStats.totalCollections,
      totalItems: indexedDBStats.totalItems,
      size: `${(indexedDBStats.size / 1024).toFixed(2)} KB`
    })

    console.log('AsyncStorage Stats:', {
      totalKeys: asyncStorageStats.totalKeys,
      totalCollections: asyncStorageStats.totalCollections,
      totalItems: asyncStorageStats.totalItems,
      size: `${(asyncStorageStats.size / 1024).toFixed(2)} KB`
    })

    // Disconnect from both
    await Promise.all([
      indexedDB.disconnect(),
      asyncStorage.disconnect()
    ])
    console.log('✅ Disconnected from both storage systems')

  } catch (error) {
    console.error('❌ Integration error:', error)
  }
}

async function demonstrateErrorHandling() {
  console.log('\n--- Error Handling Demonstration ---')

  // Create adapter with high failure rate
  const adapter = createIndexedDBAdapter({
    failureRate: 0.3, // 30% failure rate
    maxSize: 1000, // Very small quota
    latency: 0,
    debug: true
  })

  try {
    await adapter.connect()

    console.log('Testing failure simulation...')
    let successCount = 0
    let failureCount = 0

    for (let i = 0; i < 20; i++) {
      try {
        await adapter.set(`key${i}`, `value${i}`)
        successCount++
      } catch (error) {
        failureCount++
        console.log(`❌ Operation ${i} failed:`, error.message)
      }
    }

    console.log(`\nResults: ${successCount} successes, ${failureCount} failures`)

    console.log('\nTesting quota limits...')
    try {
      const largeData = 'x'.repeat(2000) // Exceeds 1000 byte limit
      await adapter.set('large', largeData)
    } catch (error) {
      console.log('✅ Correctly caught quota error:', error.message)
    }

    await adapter.disconnect()

  } catch (error) {
    console.error('❌ Error handling demo failed:', error)
  }
}

// Run all demonstrations
async function runAllDemos() {
  console.log('🚀 Starting Storage Mock Demonstrations...\n')

  await demonstrateIndexedDBMock()
  await demonstrateAsyncStorageMock()
  await demonstrateIntegration()
  await demonstrateErrorHandling()

  console.log('\n=== Storage Mock Demonstrations Completed ===')
  console.log('\nKey Benefits Demonstrated:')
  console.log('✅ Realistic persistence simulation')
  console.log('✅ Comprehensive error handling')
  console.log('✅ Network and quota simulation')
  console.log('✅ Event-driven updates')
  console.log('✅ Cross-platform compatibility')
  console.log('✅ Future-proof architecture')
  console.log('✅ Decoupled storage backends')
  console.log('✅ Robust testing capabilities')
}

// Run the demonstrations
runAllDemos().catch(console.error) 