import { z } from 'zod'
import type { ZodSchema } from 'zod'
import { reactive } from '../reactive.js'

// Collection readiness state
export enum CollectionState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  DISCONNECTED = 'disconnected'
}

// Collection readiness interface
export interface CollectionReadiness {
  state: CollectionState
  error?: Error | undefined
  lastCheck?: Date
}

// Enhanced collection interface with readiness
export interface Collection<T extends { id: any }> {
  // Core CRUD operations
  insert(item: T): void
  tryInsert(item: T): InsertResult<T>
  update(id: T['id'], updates: Partial<T>): void
  tryUpdate(id: T['id'], updates: Partial<T>): UpdateResult<T>
  delete(id: T['id']): void
  tryDelete(id: T['id']): DeleteResult<T>
  
  // Query operations
  find(filter?: Partial<T>): any
  findOne(filter?: Partial<T>): T | undefined
  
  // Readiness and state management
  readonly readiness: CollectionReadiness
  isReady(): boolean
  waitForReady(): Promise<void>
  
  // Collection metadata
  readonly name: string
  readonly schema: ZodSchema<T>
  readonly count: number
}

// Result types for safe operations
export interface InsertResult<T> {
  success: boolean
  data?: T
  errors?: z.ZodError[]
}

export interface UpdateResult<T> {
  success: boolean
  data?: T
  errors?: z.ZodError[]
}

export interface DeleteResult<T> {
  success: boolean
  data?: T
  error?: string
}

// Global collection registry
const collections = new Map<string, Collection<any>>()
const schemas = new Map<string, ZodSchema>()

// Readiness manager
class ReadinessManager {
  private readinessStates = new Map<string, CollectionReadiness>()
  private readinessCallbacks = new Map<string, Set<() => void>>()

  setState(collectionName: string, state: CollectionState, error?: Error) {
    const readiness: CollectionReadiness = {
      state,
      error,
      lastCheck: new Date()
    }
    
    this.readinessStates.set(collectionName, readiness)
    
    // Notify callbacks
    const callbacks = this.readinessCallbacks.get(collectionName)
    if (callbacks) {
      callbacks.forEach(callback => callback())
    }
  }

  getState(collectionName: string): CollectionReadiness {
    return this.readinessStates.get(collectionName) || {
      state: CollectionState.INITIALIZING,
      lastCheck: new Date()
    }
  }

  onReady(collectionName: string, callback: () => void) {
    if (!this.readinessCallbacks.has(collectionName)) {
      this.readinessCallbacks.set(collectionName, new Set())
    }
    this.readinessCallbacks.get(collectionName)!.add(callback)
  }

  offReady(collectionName: string, callback: () => void) {
    const callbacks = this.readinessCallbacks.get(collectionName)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }
}

const readinessManager = new ReadinessManager()

// Warning system
class WarningSystem {
  private warnings = new Set<string>()

  warn(message: string, context?: string) {
    const warningKey = `${message}:${context || ''}`
    if (!this.warnings.has(warningKey)) {
      this.warnings.add(warningKey)
      console.warn(`[rxDB2] ${message}${context ? ` (${context})` : ''}`)
    }
  }

  clearWarnings() {
    this.warnings.clear()
  }
}

const warningSystem = new WarningSystem()

export function defineCollection<T extends { id: any }>(name: string, schema: ZodSchema<T>): Collection<T> {
  // Initialize readiness state
  readinessManager.setState(name, CollectionState.INITIALIZING)
  
  // Simulate async initialization (in real implementation, this would check backing store)
  setTimeout(() => {
    readinessManager.setState(name, CollectionState.READY)
  }, 0)

  const data = reactive<T[]>([])
  const readiness = reactive<CollectionReadiness>({
    state: CollectionState.INITIALIZING,
    lastCheck: new Date()
  })

  // Update readiness state when it changes
  readinessManager.onReady(name, () => {
    const state = readinessManager.getState(name)
    readiness.set(state)
  })

  const collection: Collection<T> = {
    name,
    schema,
    get count() { return data.get().length },
    get readiness() { return readiness.get() },

    isReady(): boolean {
      return readiness.get().state === CollectionState.READY
    },

    async waitForReady(): Promise<void> {
      if (this.isReady()) return
      
      return new Promise((resolve) => {
        const checkReady = () => {
          if (this.isReady()) {
            readinessManager.offReady(name, checkReady)
            resolve()
          }
        }
        readinessManager.onReady(name, checkReady)
        checkReady() // Check immediately in case it's already ready
      })
    },

    insert(item: T): void {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Operation may fail.`, 'insert')
      }

      const result = this.tryInsert(item)
      if (!result.success) {
        throw new Error(`Insert failed: ${result.errors?.map(e => e.message).join(', ')}`)
      }
    },

    tryInsert(item: T): InsertResult<T> {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Insert may fail.`, 'tryInsert')
      }

      try {
        const validated = schema.parse(item)
        const existing = data.get().find((d: T) => d.id === validated.id)
        
        if (existing) {
          return {
            success: false,
            errors: [new z.ZodError([{
              code: 'custom',
              path: ['id'],
              message: 'Item with this ID already exists',
              input: validated.id
            }])]
          }
        }

        data.set([...data.get(), validated])
        return { success: true, data: validated }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return { success: false, errors: [error] }
        }
        return { success: false, errors: [new z.ZodError([{
          code: 'custom',
          path: [],
          message: error instanceof Error ? error.message : 'Unknown error',
          input: item
        }])] }
      }
    },

    update(id: T['id'], updates: Partial<T>): void {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Operation may fail.`, 'update')
      }

      const result = this.tryUpdate(id, updates)
      if (!result.success) {
        throw new Error(`Update failed: ${result.errors?.map(e => e.message).join(', ')}`)
      }
    },

    tryUpdate(id: T['id'], updates: Partial<T>): UpdateResult<T> {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Update may fail.`, 'tryUpdate')
      }

      try {
        const items = data.get()
        const index = items.findIndex(item => item.id === id)
        
        if (index === -1) {
          return {
            success: false,
            errors: [new z.ZodError([{
              code: 'custom',
              path: ['id'],
              message: 'Item not found',
              input: id
            }])]
          }
        }

        const updatedItem = { ...items[index], ...updates }
        const validated = schema.parse(updatedItem)
        
        const newItems = [...items]
        newItems[index] = validated
        data.set(newItems)
        
        return { success: true, data: validated }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return { success: false, errors: [error] }
        }
        return { success: false, errors: [new z.ZodError([{
          code: 'custom',
          path: [],
          message: error instanceof Error ? error.message : 'Unknown error',
          input: updates
        }])] }
      }
    },

    delete(id: T['id']): void {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Operation may fail.`, 'delete')
      }

      const result = this.tryDelete(id)
      if (!result.success) {
        throw new Error(`Delete failed: ${result.error}`)
      }
    },

    tryDelete(id: T['id']): DeleteResult<T> {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Delete may fail.`, 'tryDelete')
      }

      const items = data.get()
      const index = items.findIndex(item => item.id === id)
      
      if (index === -1) {
        return {
          success: false,
          error: 'Item not found'
        }
      }

      const deletedItem = items[index]
      const newItems = items.filter(item => item.id !== id)
      data.set(newItems)
      
      return { success: true, data: deletedItem }
    },

    find(filter?: Partial<T>): any {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Query may return incomplete results.`, 'find')
      }

      const items = data.get()
      const filtered = filter ? filterDocs(items, filter) : items
      
      // Return reactive array that updates when data changes
      const result = reactive(filtered)
      
      // Subscribe to data changes and update result
      data.subscribe((newItems) => {
        const newFiltered = filter ? filterDocs(newItems, filter) : newItems
        result.set(newFiltered)
      })
      
      return result
    },

    findOne(filter?: Partial<T>): T | undefined {
      if (!this.isReady()) {
        warningSystem.warn(`Collection '${name}' not ready. Query may return incomplete results.`, 'findOne')
      }

      const items = data.get()
      return filter ? filterDocs(items, filter)[0] : items[0]
    }
  }

  // Register collection
  collections.set(name, collection)
  schemas.set(name, schema)

  return collection
}

// Helper function to filter documents
function filterDocs<T>(docs: T[], filter: Partial<T>): T[] {
  return docs.filter(doc => match(doc, filter))
}

// Helper function to match document against filter
function match<T>(doc: T, filter: Partial<T>): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined) continue
    
    const docValue = (doc as any)[key]
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Handle complex filters like { $gte: 5 }
      if ('$gte' in value) {
        if (docValue < (value as any).$gte) return false
      } else if ('$lte' in value) {
        if (docValue > (value as any).$lte) return false
      } else if ('$gt' in value) {
        if (docValue <= (value as any).$gt) return false
      } else if ('$lt' in value) {
        if (docValue >= (value as any).$lt) return false
      } else if ('$in' in value) {
        if (!(value as any).$in.includes(docValue)) return false
      } else if ('$regex' in value) {
        const regex = new RegExp((value as any).$regex)
        if (!regex.test(String(docValue))) return false
      } else {
        // Recursive match for nested objects
        if (!match(docValue, value as any)) return false
      }
    } else {
      // Simple equality check
      if (docValue !== value) return false
    }
  }
  return true
}

export function getCollection<T>(name: string): Collection<T> | undefined {
  return collections.get(name)
}

export function getSchema(name: string): ZodSchema | undefined {
  return schemas.get(name)
}

// Export readiness utilities
export function setCollectionState(name: string, state: CollectionState, error?: Error) {
  readinessManager.setState(name, state, error)
}

export function getCollectionState(name: string): CollectionReadiness {
  return readinessManager.getState(name)
}

export function clearWarnings() {
  warningSystem.clearWarnings()
} 