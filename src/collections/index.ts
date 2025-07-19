// Public Collections API
// This module exports all collection management functionality

// Modern reactive collections
export { defineCollection } from '../../packages/engine/src/database/defineCollection.js'
export type { 
  Collection, 
  InsertResult, 
  UpdateResult, 
  DeleteResult, 
  QueryResult 
} from '../../packages/engine/src/database/defineCollection.js'

// Legacy collections (for backward compatibility)
export { defineCollection as defineLegacyCollection } from '../core/collection.js'
export type { CollectionDefinition } from '../core/collection.js'

// Database creation
export { createDatabase } from '../core/db.js'
export type { Database } from '../core/db.js' 