// Public Storage API
// This module exports all storage adapter functionality

// Storage adapters
export { createIndexedDBAdapter } from './indexeddb.js'
export { createAsyncStorageAdapter } from './asyncstorage.js'

// Storage types
export type { 
  StorageAdapter, 
  StorageOptions, 
  StorageEvent, 
  StorageStats,
  StorageError,
  ConnectionError,
  TransactionError,
  QuotaExceededError
} from './types.js' 