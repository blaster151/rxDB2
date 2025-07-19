import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IndexedDBAdapter, createIndexedDBAdapter } from '../indexeddb'
import { AsyncStorageAdapter, createAsyncStorageAdapter } from '../asyncstorage'
import { StorageError, ConnectionError, QuotaExceededError } from '../types'

describe('Storage Mock Implementations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('IndexedDB Mock', () => {
    it('should connect and disconnect properly', async () => {
      const adapter = createIndexedDBAdapter({
        debug: true,
        latency: 0
      })

      expect(adapter.isConnected()).toBe(false)
      
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
      
      await adapter.disconnect()
      expect(adapter.isConnected()).toBe(false)
    })

    it('should handle basic CRUD operations', async () => {
      const adapter = createIndexedDBAdapter({ latency: 0 })
      await adapter.connect()

      // Set and get
      await adapter.set('test-key', { name: 'test', value: 123 })
      const result = await adapter.get('test-key')
      expect(result).toEqual({ name: 'test', value: 123 })

      // Delete
      await adapter.delete('test-key')
      const deleted = await adapter.get('test-key')
      expect(deleted).toBeNull()

      // Clear
      await adapter.set('key1', 'value1')
      await adapter.set('key2', 'value2')
      await adapter.clear()
      expect(await adapter.get('key1')).toBeNull()
      expect(await adapter.get('key2')).toBeNull()
    })

    it('should handle collection operations', async () => {
      const adapter = createIndexedDBAdapter({ latency: 0 })
      await adapter.connect()

      const users = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' }
      ]

      // Set collection
      await adapter.setCollection('users', users)
      const retrieved = await adapter.getCollection('users')
      expect(retrieved).toEqual(users)

      // Add to collection
      await adapter.addToCollection('users', { id: 3, name: 'Charlie', email: 'charlie@example.com' })
      const updated = await adapter.getCollection('users')
      expect(updated).toHaveLength(3)
      expect(updated[2].name).toBe('Charlie')

      // Update in collection
      await adapter.updateInCollection('users', 1, { name: 'Alice Updated' })
      const modified = await adapter.getCollection('users')
      expect(modified[0].name).toBe('Alice Updated')

      // Remove from collection
      await adapter.removeFromCollection('users', 2)
      const filtered = await adapter.getCollection('users')
      expect(filtered).toHaveLength(2)
      expect(filtered.find(u => u.id === 2)).toBeUndefined()
    })

    it('should handle queries', async () => {
      const adapter = createIndexedDBAdapter({ latency: 0 })
      await adapter.connect()

      const posts = [
        { id: 1, title: 'Post 1', published: true, authorId: 1 },
        { id: 2, title: 'Post 2', published: false, authorId: 1 },
        { id: 3, title: 'Post 3', published: true, authorId: 2 }
      ]

      await adapter.setCollection('posts', posts)

      // Query by single field
      const published = await adapter.query('posts', { published: true })
      expect(published).toHaveLength(2)

      // Query by multiple fields
      const user1Published = await adapter.query('posts', { authorId: 1, published: true })
      expect(user1Published).toHaveLength(1)
      expect(user1Published[0].title).toBe('Post 1')
    })

    it('should handle transactions', async () => {
      const adapter = createIndexedDBAdapter({ latency: 0 })
      await adapter.connect()

      const result = await adapter.transaction(async () => {
        await adapter.set('key1', 'value1')
        await adapter.set('key2', 'value2')
        return 'transaction-complete'
      })

      expect(result).toBe('transaction-complete')
      expect(await adapter.get('key1')).toBe('value1')
      expect(await adapter.get('key2')).toBe('value2')
    })

    it('should simulate failures', async () => {
      const adapter = createIndexedDBAdapter({
        failureRate: 1.0, // 100% failure rate
        latency: 0
      })
      await adapter.connect()

      await expect(adapter.set('key', 'value')).rejects.toThrow(StorageError)
      await expect(adapter.get('key')).rejects.toThrow(StorageError)
    })

    it('should handle quota limits', async () => {
      const adapter = createIndexedDBAdapter({
        maxSize: 100, // Very small quota
        latency: 0
      })
      await adapter.connect()

      // This should work
      await adapter.set('small', 'data')

      // This should exceed quota
      const largeData = 'x'.repeat(200)
      await expect(adapter.set('large', largeData)).rejects.toThrow(QuotaExceededError)
    })

    it('should provide stats', async () => {
      const adapter = createIndexedDBAdapter({ latency: 0 })
      await adapter.connect()

      await adapter.set('key1', 'value1')
      await adapter.setCollection('users', [{ id: 1, name: 'Alice' }])

      const stats = adapter.getStats()
      expect(stats.totalKeys).toBe(2) // key1 + collection:users
      expect(stats.totalCollections).toBe(1)
      expect(stats.totalItems).toBe(1)
      expect(stats.size).toBeGreaterThan(0)
      expect(stats.lastModified).toBeInstanceOf(Date)
    })

    it('should emit events', async () => {
      const adapter = createIndexedDBAdapter({ latency: 0 })
      await adapter.connect()

      const events: any[] = []
      adapter.addEventListener((event) => events.push(event))

      await adapter.set('test', 'value')
      await adapter.delete('test')
      await adapter.setCollection('users', [{ id: 1, name: 'Alice' }])

      expect(events).toHaveLength(3)
      expect(events[0].type).toBe('set')
      expect(events[1].type).toBe('delete')
      expect(events[2].type).toBe('collection-update')
    })
  })

  describe('AsyncStorage Mock', () => {
    it('should connect and disconnect properly', async () => {
      const adapter = createAsyncStorageAdapter({
        debug: true,
        latency: 0
      })

      expect(adapter.isConnected()).toBe(false)
      
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
      
      await adapter.disconnect()
      expect(adapter.isConnected()).toBe(false)
    })

    it('should handle basic CRUD operations with prefixing', async () => {
      const adapter = createAsyncStorageAdapter({
        prefix: '@test:',
        latency: 0
      })
      await adapter.connect()

      // Set and get
      await adapter.set('user', { id: 1, name: 'Alice' })
      const result = await adapter.get('user')
      expect(result).toEqual({ id: 1, name: 'Alice' })

      // Delete
      await adapter.delete('user')
      const deleted = await adapter.get('user')
      expect(deleted).toBeNull()

      // Clear
      await adapter.set('key1', 'value1')
      await adapter.set('key2', 'value2')
      await adapter.clear()
      expect(await adapter.get('key1')).toBeNull()
      expect(await adapter.get('key2')).toBeNull()
    })

    it('should handle collection operations', async () => {
      const adapter = createAsyncStorageAdapter({ latency: 0 })
      await adapter.connect()

      const products = [
        { id: 1, name: 'Laptop', price: 999 },
        { id: 2, name: 'Phone', price: 599 }
      ]

      // Set collection
      await adapter.setCollection('products', products)
      const retrieved = await adapter.getCollection('products')
      expect(retrieved).toEqual(products)

      // Add to collection
      await adapter.addToCollection('products', { id: 3, name: 'Tablet', price: 399 })
      const updated = await adapter.getCollection('products')
      expect(updated).toHaveLength(3)
      expect(updated[2].name).toBe('Tablet')

      // Update in collection
      await adapter.updateInCollection('products', 1, { price: 1099 })
      const modified = await adapter.getCollection('products')
      expect(modified[0].price).toBe(1099)

      // Remove from collection
      await adapter.removeFromCollection('products', 2)
      const filtered = await adapter.getCollection('products')
      expect(filtered).toHaveLength(2)
      expect(filtered.find(p => p.id === 2)).toBeUndefined()
    })

    it('should handle multi-get and multi-set operations', async () => {
      const adapter = createAsyncStorageAdapter({ latency: 0 })
      await adapter.connect()

      // Multi-set
      await adapter.multiSet([
        ['user:1', { id: 1, name: 'Alice' }],
        ['user:2', { id: 2, name: 'Bob' }],
        ['settings', { theme: 'dark' }]
      ])

      // Multi-get
      const results = await adapter.multiGet(['user:1', 'user:2', 'settings'])
      expect(results).toHaveLength(3)
      expect(results[0][1]).toEqual({ id: 1, name: 'Alice' })
      expect(results[1][1]).toEqual({ id: 2, name: 'Bob' })
      expect(results[2][1]).toEqual({ theme: 'dark' })

      // Get all keys
      const keys = await adapter.getAllKeys()
      expect(keys).toContain('user:1')
      expect(keys).toContain('user:2')
      expect(keys).toContain('settings')
    })

    it('should handle network simulation', async () => {
      const adapter = createAsyncStorageAdapter({
        simulateNetworkIssues: true,
        latency: 0
      })
      await adapter.connect()

      // Simulate network going down
      adapter.setNetworkAvailable(false)
      await expect(adapter.set('key', 'value')).rejects.toThrow(ConnectionError)

      // Simulate network coming back
      adapter.setNetworkAvailable(true)
      await adapter.set('key', 'value')
      expect(await adapter.get('key')).toBe('value')
    })

    it('should handle quota limits', async () => {
      const adapter = createAsyncStorageAdapter({
        maxSize: 100, // Very small quota
        latency: 0
      })
      await adapter.connect()

      // This should work
      await adapter.set('small', 'data')

      // This should exceed quota
      const largeData = 'x'.repeat(200)
      await expect(adapter.set('large', largeData)).rejects.toThrow(QuotaExceededError)
    })

    it('should provide stats', async () => {
      const adapter = createAsyncStorageAdapter({ latency: 0 })
      await adapter.connect()

      await adapter.set('key1', 'value1')
      await adapter.setCollection('users', [{ id: 1, name: 'Alice' }])

      const stats = adapter.getStats()
      expect(stats.totalKeys).toBe(2) // key1 + collection:users
      expect(stats.totalCollections).toBe(1)
      expect(stats.totalItems).toBe(1)
      expect(stats.size).toBeGreaterThan(0)
      expect(stats.lastModified).toBeInstanceOf(Date)
    })

    it('should emit events', async () => {
      const adapter = createAsyncStorageAdapter({ latency: 0 })
      await adapter.connect()

      const events: any[] = []
      adapter.addEventListener((event) => events.push(event))

      await adapter.set('test', 'value')
      await adapter.delete('test')
      await adapter.setCollection('users', [{ id: 1, name: 'Alice' }])

      expect(events).toHaveLength(3)
      expect(events[0].type).toBe('set')
      expect(events[1].type).toBe('delete')
      expect(events[2].type).toBe('collection-update')
    })

    it('should reset mock data', async () => {
      const adapter = createAsyncStorageAdapter({ latency: 0 })
      await adapter.connect()

      await adapter.set('key1', 'value1')
      await adapter.setCollection('users', [{ id: 1, name: 'Alice' }])

      expect(await adapter.get('key1')).toBe('value1')
      expect(await adapter.getCollection('users')).toHaveLength(1)

      adapter.reset()

      expect(await adapter.get('key1')).toBeNull()
      expect(await adapter.getCollection('users')).toHaveLength(0)
    })
  })

  describe('Integration Tests', () => {
    it('should demonstrate realistic persistence simulation', async () => {
      const indexedDB = createIndexedDBAdapter({
        dbName: 'test-db',
        latency: 5,
        failureRate: 0.1, // 10% failure rate
        debug: true
      })

      const asyncStorage = createAsyncStorageAdapter({
        prefix: '@test:',
        latency: 3,
        failureRate: 0.05, // 5% failure rate
        debug: true
      })

      await indexedDB.connect()
      await asyncStorage.connect()

      // Simulate realistic data operations
      const users = [
        { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
        { id: 2, name: 'Bob', email: 'bob@example.com', active: false },
        { id: 3, name: 'Charlie', email: 'charlie@example.com', active: true }
      ]

      // Store in both backends
      await indexedDB.setCollection('users', users)
      await asyncStorage.setCollection('users', users)

      // Query from both backends
      const indexedDBUsers = await indexedDB.query('users', { active: true })
      const asyncStorageUsers = await asyncStorage.query('users', { active: true })

      expect(indexedDBUsers).toHaveLength(2)
      expect(asyncStorageUsers).toHaveLength(2)

      // Update user
      await indexedDB.updateInCollection('users', 1, { name: 'Alice Updated' })
      await asyncStorage.updateInCollection('users', 1, { name: 'Alice Updated' })

      // Verify updates
      const updatedIndexedDB = await indexedDB.getCollection('users')
      const updatedAsyncStorage = await asyncStorage.getCollection('users')

      expect(updatedIndexedDB[0].name).toBe('Alice Updated')
      expect(updatedAsyncStorage[0].name).toBe('Alice Updated')

      // Check stats
      const indexedDBStats = indexedDB.getStats()
      const asyncStorageStats = asyncStorage.getStats()

      expect(indexedDBStats.totalItems).toBe(3)
      expect(asyncStorageStats.totalItems).toBe(3)

      await indexedDB.disconnect()
      await asyncStorage.disconnect()
    })

    it('should handle concurrent operations', async () => {
      const adapter = createIndexedDBAdapter({ latency: 10 })
      await adapter.connect()

      // Simulate concurrent operations
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(adapter.set(`key${i}`, `value${i}`))
      }

      await Promise.all(promises)

      // Verify all operations completed
      for (let i = 0; i < 10; i++) {
        const value = await adapter.get(`key${i}`)
        expect(value).toBe(`value${i}`)
      }
    })

    it('should demonstrate error handling patterns', async () => {
      const adapter = createIndexedDBAdapter({
        failureRate: 0.5, // 50% failure rate
        latency: 0
      })
      await adapter.connect()

      let successCount = 0
      let failureCount = 0

      // Attempt multiple operations
      for (let i = 0; i < 20; i++) {
        try {
          await adapter.set(`key${i}`, `value${i}`)
          successCount++
        } catch (error) {
          failureCount++
          expect(error).toBeInstanceOf(StorageError)
        }
      }

      // Should have some successes and some failures
      expect(successCount).toBeGreaterThan(0)
      expect(failureCount).toBeGreaterThan(0)
      expect(successCount + failureCount).toBe(20)
    })
  })
}) 