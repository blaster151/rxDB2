// IndexedDB storage backend
// Browser-based persistent storage with comprehensive mock implementation

import { StorageAdapter, StorageOptions, StorageEvent, StorageStats, StorageError, ConnectionError, TransactionError, QuotaExceededError } from './types'

interface IndexedDBOptions extends StorageOptions {
  dbName?: string
  storeName?: string
  maxSize?: number // Mock quota limit in bytes
  latency?: number // Mock network latency in ms
  failureRate?: number // Mock failure rate (0-1)
}

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null
  private connected = false
  private options: Required<IndexedDBOptions>
  private eventListeners: ((event: StorageEvent) => void)[] = []
  private mockData = new Map<string, any>()
  private collections = new Map<string, any[]>()
  private stats: StorageStats

  constructor(options: IndexedDBOptions = {}) {
    this.options = {
      name: 'rxdb',
      version: 1,
      collections: [],
      autoConnect: false,
      debug: false,
      dbName: 'rxdb-mock',
      storeName: 'data',
      maxSize: 50 * 1024 * 1024, // 50MB default
      latency: 10, // 10ms default latency
      failureRate: 0, // 0% failure rate by default
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

  // Mock delay to simulate real IndexedDB latency
  private async delay(): Promise<void> {
    if (this.options.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.latency))
    }
  }

  // Mock failure simulation
  private async simulateFailure(): Promise<void> {
    if (Math.random() < this.options.failureRate) {
      throw new StorageError('Simulated IndexedDB failure', 'MOCK_FAILURE')
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

  async connect(): Promise<void> {
    try {
      await this.delay()
      await this.simulateFailure()

      // Simulate IndexedDB connection
      if (typeof window !== 'undefined' && window.indexedDB) {
        // Real IndexedDB environment - create actual connection
        return new Promise((resolve, reject) => {
          const request = window.indexedDB.open(this.options.dbName, this.options.version)
          
          request.onerror = () => {
            reject(new ConnectionError('Failed to open IndexedDB', request.error || undefined))
          }
          
          request.onsuccess = () => {
            this.db = request.result
            this.connected = true
            resolve()
          }
          
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(this.options.storeName)) {
              db.createObjectStore(this.options.storeName, { keyPath: 'key' })
            }
          }
        })
      } else {
        // Mock environment - simulate connection
        this.connected = true
        if (this.options.debug) {
          console.log('IndexedDB Mock: Connected to', this.options.dbName)
        }
      }
    } catch (error) {
      throw new ConnectionError('Failed to connect to IndexedDB', error as Error)
    }
  }

  async disconnect(): Promise<void> {
    await this.delay()
    
    if (this.db) {
      this.db.close()
      this.db = null
    }
    
    this.connected = false
    
    if (this.options.debug) {
      console.log('IndexedDB Mock: Disconnected')
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  async get<T>(key: string): Promise<T | null> {
    await this.delay()
    await this.simulateFailure()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to IndexedDB')
    }

    if (this.db) {
      // Real IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.options.storeName], 'readonly')
        const store = transaction.objectStore(this.options.storeName)
        const request = store.get(key)
        
        request.onerror = () => reject(new StorageError('Failed to get data', 'GET_ERROR', request.error || undefined))
        request.onsuccess = () => resolve(request.result?.value || null)
      })
    } else {
      // Mock implementation
      const value = this.mockData.get(key)
      return value || null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.delay()
    await this.simulateFailure()
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to IndexedDB')
    }

    const size = this.calculateSize(value)
    if (this.stats.size + size > this.options.maxSize) {
      throw new QuotaExceededError('Storage quota exceeded')
    }

    if (this.db) {
      // Real IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.options.storeName], 'readwrite')
        const store = transaction.objectStore(this.options.storeName)
        const request = store.put({ key, value })
        
        request.onerror = () => reject(new StorageError('Failed to set data', 'SET_ERROR', request.error || undefined))
        request.onsuccess = () => {
          this.on({
            type: 'set',
            key,
            data: value,
            timestamp: Date.now()
          })
          resolve()
        }
      })
    } else {
      // Mock implementation
      this.mockData.set(key, value)
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
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to IndexedDB')
    }

    if (this.db) {
      // Real IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.options.storeName], 'readwrite')
        const store = transaction.objectStore(this.options.storeName)
        const request = store.delete(key)
        
        request.onerror = () => reject(new StorageError('Failed to delete data', 'DELETE_ERROR', request.error || undefined))
        request.onsuccess = () => {
          this.on({
            type: 'delete',
            key,
            timestamp: Date.now()
          })
          resolve()
        }
      })
    } else {
      // Mock implementation
      this.mockData.delete(key)
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
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to IndexedDB')
    }

    if (this.db) {
      // Real IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.options.storeName], 'readwrite')
        const store = transaction.objectStore(this.options.storeName)
        const request = store.clear()
        
        request.onerror = () => reject(new StorageError('Failed to clear data', 'CLEAR_ERROR', request.error || undefined))
        request.onsuccess = () => {
          this.on({
            type: 'clear',
            timestamp: Date.now()
          })
          resolve()
        }
      })
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
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to IndexedDB')
    }

    const key = `collection:${collectionName}`
    
    if (this.db) {
      // Real IndexedDB
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
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to IndexedDB')
    }

    const key = `collection:${collectionName}`
    
    if (this.db) {
      // Real IndexedDB
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
    
    if (!this.connected) {
      throw new ConnectionError('Not connected to IndexedDB')
    }

    try {
      if (this.db) {
        // Real IndexedDB transaction
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([this.options.storeName], 'readwrite')
          
          transaction.oncomplete = async () => {
            try {
              const result = await operations()
              resolve(result)
            } catch (error) {
              reject(new TransactionError('Transaction operations failed', error as Error))
            }
          }
          
          transaction.onerror = () => {
            reject(new TransactionError('Transaction failed', transaction.error || undefined))
          }
        })
      } else {
        // Mock transaction
        return await operations()
      }
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
}

// Factory function for creating IndexedDB adapter
export function createIndexedDBAdapter(options?: IndexedDBOptions): IndexedDBAdapter {
  return new IndexedDBAdapter(options)
} 