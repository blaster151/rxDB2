// Storage Chunk
// This chunk contains storage adapter functionality

// Storage adapters
export { createIndexedDBAdapter } from '../storage/indexeddb.js'
export { createAsyncStorageAdapter } from '../storage/asyncstorage.js'

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
} from '../storage/types.js' 