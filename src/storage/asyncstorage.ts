// AsyncStorage mock implementation
// React Native AsyncStorage simulation with comprehensive testing features

import { StorageAdapter, StorageOptions, StorageEvent, StorageStats, StorageError, ConnectionError, TransactionError, QuotaExceededError } from './types'

interface AsyncStorageOptions extends StorageOptions {
  prefix?: string
  maxSize?: number // Mock quota limit in bytes
  latency?: number // Mock network latency in ms
  failureRate?: number // Mock failure rate (0-1)
  simulateNetworkIssues?: boolean // Simulate network connectivity issues
}

export class AsyncStorageAdapter implements StorageAdapter {
  private connected = false
  private options: Required<AsyncStorageOptions>
  private eventListeners: ((event: StorageEvent) => void)[] = []
  private mockData = new Map<string, any>()
  private collections = new Map<string, any[]>()
  private stats: StorageStats
  private networkAvailable = true

  constructor(options: AsyncStorageOptions = {}) {
    this.options = {
      name: 'rxdb-async',
      version: 1,
      collections: [],
      autoConnect: false,
      debug: false,
      prefix: '@rxdb:',
      maxSize: 6 * 1024 * 1024, // 6MB default (React Native limit)
      latency: 5, // 5ms default latency
      failureRate: 0, // 0% failure rate by default
      simulateNetworkIssues: false,
      ...options
    }

    this.stats = {
      totalKeys: 0,
      totalCollections: 0,
      totalItems: 0,
      size: 0,
      lastModified: new Date()
    }

    if (this.options.autoConnect) {
      this.connect()
    }
  }

  // Event system for reactive updates
  on(event: StorageEvent) {
    this.eventListeners.forEach(listener => listener(event))
  }

  addEventListener(listener: (event: StorageEvent) => void) {
    this.eventListeners.push(listener)
  }

  removeEventListener(listener: (event: StorageEvent) => void) {
    const index = this.eventListeners.indexOf(listener)
    if (index > -1) {
      this.eventListeners.splice(index, 1)
    }
  }

  // Mock delay to simulate real AsyncStorage latency
  private async delay(): Promise<void> {
    if (this.options.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.latency))
    }
  }

  // Mock failure simulation
  private async simulateFailure(): Promise<void> {
    if (Math.random() < this.options.failureRate) {
      throw new StorageError('Simulated AsyncStorage failure', 'MOCK_FAILURE')
    }
  }

  // Simulate network issues
  private async checkNetwork(): Promise<void> {
    if (this.options.simulateNetworkIssues && !this.networkAvailable) {
      throw new ConnectionError('Network unavailable')
    }
  }

  // Calculate approximate size of data
  private calculateSize(data: any): number {
    return JSON.stringify(data).length
  }

  // Update stats
  private updateStats() {
    this.stats.totalKeys = this.mockData.size
    this.stats.totalCollections = this.collections.size
    this.stats.totalItems = Array.from(this.collections.values()).reduce((sum, items) => sum + items.length, 0)
    this.stats.size = this.calculateSize({ data: this.mockData, collections: this.collections })
    this.stats.lastModified = new Date()
  }

  // Get prefixed key
  private getPrefixedKey(key: string): string {
    return `${this.options.prefix}${key}`
  }

  // Remove prefix from key
  private removePrefix(prefixedKey: string): string {
    return prefixedKey.replace(this.options.prefix, '')
  }

  async connect(): Promise<void> {
    try {
      await this.delay()
      await this.simulateFailure()
      await this.checkNetwork()

      // Simulate AsyncStorage connection
      if (typeof globalThis !== 'undefined' && (globalThis as any).AsyncStorage) {
        // Real AsyncStorage environment - test connection
        try {
          await (globalThis as any).AsyncStorage.setItem('__test__', 'test')
          await (globalThis as any).AsyncStorage.removeItem('__test__')
        } catch (error) {
          throw new ConnectionError('AsyncStorage not available', error as Error)
        }
      }

      this.connected = true
      
      if (this.options.debug) {
        console.log('AsyncStorage Mock: Connected with prefix', this.options.prefix)
      }
    } catch (error) {
      throw new ConnectionError('Failed to connect to AsyncStorage', error as Error)
    }
  }

  async disconnect(): Promise<void> {
    await this.delay()
    
    this.connected = false
    
    if (this.options.debug) {
      console.log('AsyncStorage Mock: Disconnected')
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  async get<T>(key: string): Promise<T | null> {
    await this.delay()
    await this.simulateFailure()
    await this.checkNetwork()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to AsyncStorage')
    }

    const prefixedKey = this.getPrefixedKey(key)

    if (typeof globalThis !== 'undefined' && (globalThis as any).AsyncStorage) {
      // Real AsyncStorage
      try {
        const value = await (globalThis as any).AsyncStorage.getItem(prefixedKey)
        return value ? JSON.parse(value) : null
      } catch (error) {
        throw new StorageError('Failed to get data from AsyncStorage', 'GET_ERROR', error as Error)
      }
    } else {
      // Mock implementation
      const value = this.mockData.get(prefixedKey)
      return value || null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.delay()
    await this.simulateFailure()
    await this.checkNetwork()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to AsyncStorage')
    }

    const size = this.calculateSize(value)
    if (this.stats.size + size > this.options.maxSize) {
      throw new QuotaExceededError('Storage quota exceeded')
    }

    const prefixedKey = this.getPrefixedKey(key)

    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage
      try {
        await global.AsyncStorage.setItem(prefixedKey, JSON.stringify(value))
        this.on({
          type: 'set',
          key,
          data: value,
          timestamp: Date.now()
        })
      } catch (error) {
        throw new StorageError('Failed to set data in AsyncStorage', 'SET_ERROR', error as Error)
      }
    } else {
      // Mock implementation
      this.mockData.set(prefixedKey, value)
      this.updateStats()
      
      this.on({
        type: 'set',
        key,
        data: value,
        timestamp: Date.now()
      })
    }
  }

  async delete(key: string): Promise<void> {
    await this.delay()
    await this.simulateFailure()
    await this.checkNetwork()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to AsyncStorage')
    }

    const prefixedKey = this.getPrefixedKey(key)

    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage
      try {
        await global.AsyncStorage.removeItem(prefixedKey)
        this.on({
          type: 'delete',
          key,
          timestamp: Date.now()
        })
      } catch (error) {
        throw new StorageError('Failed to delete data from AsyncStorage', 'DELETE_ERROR', error as Error)
      }
    } else {
      // Mock implementation
      this.mockData.delete(prefixedKey)
      this.updateStats()
      
      this.on({
        type: 'delete',
        key,
        timestamp: Date.now()
      })
    }
  }

  async clear(): Promise<void> {
    await this.delay()
    await this.simulateFailure()
    await this.checkNetwork()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to AsyncStorage')
    }

    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage - clear only our prefixed keys
      try {
        const keys = await global.AsyncStorage.getAllKeys()
        const prefixedKeys = keys.filter(key => key.startsWith(this.options.prefix))
        await global.AsyncStorage.multiRemove(prefixedKeys)
        this.on({
          type: 'clear',
          timestamp: Date.now()
        })
      } catch (error) {
        throw new StorageError('Failed to clear AsyncStorage', 'CLEAR_ERROR', error as Error)
      }
    } else {
      // Mock implementation
      this.mockData.clear()
      this.collections.clear()
      this.updateStats()
      
      this.on({
        type: 'clear',
        timestamp: Date.now()
      })
    }
  }

  async getCollection<T>(collectionName: string): Promise<T[]> {
    await this.delay()
    await this.simulateFailure()
    await this.checkNetwork()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to AsyncStorage')
    }

    const key = `collection:${collectionName}`
    
    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage
      const data = await this.get<T[]>(key)
      return data || []
    } else {
      // Mock implementation
      return this.collections.get(collectionName) || []
    }
  }

  async setCollection<T>(collectionName: string, items: T[]): Promise<void> {
    await this.delay()
    await this.simulateFailure()
    await this.checkNetwork()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to AsyncStorage')
    }

    const key = `collection:${collectionName}`
    
    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage
      await this.set(key, items)
    } else {
      // Mock implementation
      this.collections.set(collectionName, items)
      this.updateStats()
    }

    this.on({
      type: 'collection-update',
      collectionName,
      data: items,
      timestamp: Date.now()
    })
  }

  async addToCollection<T>(collectionName: string, item: T): Promise<void> {
    const items = await this.getCollection<T>(collectionName)
    items.push(item)
    await this.setCollection(collectionName, items)
  }

  async updateInCollection<T>(collectionName: string, id: any, updates: Partial<T>): Promise<void> {
    const items = await this.getCollection<T>(collectionName)
    const index = items.findIndex(item => (item as any).id === id)
    
    if (index !== -1) {
      items[index] = { ...items[index], ...updates }
      await this.setCollection(collectionName, items)
    }
  }

  async removeFromCollection(collectionName: string, id: any): Promise<void> {
    const items = await this.getCollection(collectionName)
    const filtered = items.filter(item => (item as any).id !== id)
    await this.setCollection(collectionName, filtered)
  }

  async query<T>(collectionName: string, filter: Partial<T>): Promise<T[]> {
    const items = await this.getCollection<T>(collectionName)
    
    return items.filter(item => {
      return Object.entries(filter).every(([key, value]) => {
        const itemValue = (item as any)[key]
        return itemValue === value
      })
    })
  }

  async transaction<T>(operations: () => Promise<T>): Promise<T> {
    await this.delay()
    await this.simulateFailure()
    await this.checkNetwork()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to AsyncStorage')
    }

    try {
      // AsyncStorage doesn't have native transactions, so we simulate them
      return await operations()
    } catch (error) {
      throw new TransactionError('Transaction failed', error as Error)
    }
  }

  // Additional utility methods for testing
  getStats(): StorageStats {
    return { ...this.stats }
  }

  getMockData(): Map<string, any> {
    return new Map(this.mockData)
  }

  getCollections(): Map<string, any[]> {
    return new Map(this.collections)
  }

  // Reset mock data for testing
  reset(): void {
    this.mockData.clear()
    this.collections.clear()
    this.updateStats()
  }

  // Simulate network connectivity
  setNetworkAvailable(available: boolean): void {
    this.networkAvailable = available
  }

  // Get all keys with prefix
  async getAllKeys(): Promise<string[]> {
    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage
      const keys = await global.AsyncStorage.getAllKeys()
      return keys.filter(key => key.startsWith(this.options.prefix))
        .map(key => this.removePrefix(key))
    } else {
      // Mock implementation
      return Array.from(this.mockData.keys()).map(key => this.removePrefix(key))
    }
  }

  // Multi-get operation
  async multiGet(keys: string[]): Promise<[string, any][]> {
    const prefixedKeys = keys.map(key => this.getPrefixedKey(key))
    
    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage
      const results = await global.AsyncStorage.multiGet(prefixedKeys)
      return results.map(([prefixedKey, value]) => [
        this.removePrefix(prefixedKey),
        value ? JSON.parse(value) : null
      ])
    } else {
      // Mock implementation
      return prefixedKeys.map(prefixedKey => [
        this.removePrefix(prefixedKey),
        this.mockData.get(prefixedKey) || null
      ])
    }
  }

  // Multi-set operation
  async multiSet(keyValuePairs: [string, any][]): Promise<void> {
    const prefixedPairs = keyValuePairs.map(([key, value]) => [this.getPrefixedKey(key), value])
    
    if (typeof global !== 'undefined' && global.AsyncStorage) {
      // Real AsyncStorage
      const stringifiedPairs = prefixedPairs.map(([key, value]) => [key, JSON.stringify(value)])
      await global.AsyncStorage.multiSet(stringifiedPairs as [string, string][])
    } else {
      // Mock implementation
      for (const [prefixedKey, value] of prefixedPairs) {
        this.mockData.set(prefixedKey, value)
      }
      this.updateStats()
    }

    // Emit events for each set operation
    for (const [key, value] of keyValuePairs) {
      this.on({
        type: 'set',
        key,
        data: value,
        timestamp: Date.now()
      })
    }
  }
}

// Factory function for creating AsyncStorage adapter
export function createAsyncStorageAdapter(options?: AsyncStorageOptions): AsyncStorageAdapter {
  return new AsyncStorageAdapter(options)
} 