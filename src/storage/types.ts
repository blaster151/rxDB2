// Storage interface types
// Common interfaces for storage backends

export interface StorageAdapter {
  // Basic CRUD operations
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  
  // Collection operations
  getCollection<T>(collectionName: string): Promise<T[]>
  setCollection<T>(collectionName: string, items: T[]): Promise<void>
  addToCollection<T>(collectionName: string, item: T): Promise<void>
  updateInCollection<T>(collectionName: string, id: any, updates: Partial<T>): Promise<void>
  removeFromCollection(collectionName: string, id: any): Promise<void>
  
  // Query operations
  query<T>(collectionName: string, filter: Partial<T>): Promise<T[]>
  
  // Transaction support
  transaction<T>(operations: () => Promise<T>): Promise<T>
  
  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
}

export interface StorageOptions {
  name?: string
  version?: number
  collections?: string[]
  autoConnect?: boolean
  debug?: boolean
}

export interface StorageEvent {
  type: 'set' | 'delete' | 'clear' | 'collection-update'
  key?: string
  collectionName?: string
  data?: any
  timestamp: number
}

export interface StorageStats {
  totalKeys: number
  totalCollections: number
  totalItems: number
  size: number // Approximate size in bytes
  lastModified: Date
}

// Error types
export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

export class ConnectionError extends StorageError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', originalError)
    this.name = 'ConnectionError'
  }
}

export class TransactionError extends StorageError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', originalError)
    this.name = 'TransactionError'
  }
}

export class QuotaExceededError extends StorageError {
  constructor(message: string, originalError?: Error) {
    super(message, 'QUOTA_EXCEEDED', originalError)
    this.name = 'QuotaExceededError'
  }
} 