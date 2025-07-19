import { z } from 'zod'
import type { ZodSchema } from 'zod'
import { reactive } from '../reactive.js'
import type { 
  MigrationTable, 
  VersionedData, 
  MigrationErrorStrategy,
  MigrationResult 
} from '../migration/types.js'
import { 
  runMigrations, 
  createVersionedData, 
  extractData, 
  getVersion, 
  needsMigration,
  validateMigrationTable 
} from '../migration/migration-runner.js'

// Enhanced collection interface with migration support
export interface CollectionWithMigrations<T extends { id: any }> {
  // Core CRUD operations (same as before)
  insert(item: T): void
  tryInsert(item: T): InsertResult<T>
  update(id: T['id'], updates: Partial<T>): void
  tryUpdate(id: T['id'], updates: Partial<T>): UpdateResult<T>
  delete(id: T['id']): void
  tryDelete(id: T['id']): DeleteResult<T>
  
  // Query operations
  find(filter?: Partial<T>): T[]
  findOne(filter?: Partial<T>): T | undefined
  
  // Migration-specific operations
  migrateToVersion(targetVersion: number, dryRun?: boolean): Promise<MigrationResult<T[]>>
  getCurrentVersion(): number
  getMigrationStatus(): MigrationStatus
  
  // Collection metadata
  readonly name: string
  readonly schema: ZodSchema<T>
  readonly count: number
  readonly schemaVersion: number
}

// Migration status
export interface MigrationStatus {
  currentVersion: number
  targetVersion: number
  needsMigration: boolean
  lastMigration?: Date
  migrationErrors: string[]
}

// Result types (same as before)
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

// Enhanced collection configuration
export interface CollectionConfig<T extends { id: any }> {
  name: string
  schema: ZodSchema<T>
  schemaVersion: number
  migrations?: MigrationTable<T[]>
  onMigrationError?: MigrationErrorStrategy
  validateAfterMigration?: boolean
  initialState?: T[]
}

// Global collection registry with versioning
const collections = new Map<string, CollectionWithMigrations<any>>()
const versionedData = new Map<string, VersionedData<any[]>>()

/**
 * Define a collection with schema versioning and migration support
 */
export function defineCollectionWithMigrations<T extends { id: any }>(
  config: CollectionConfig<T>
): CollectionWithMigrations<T> {
  const {
    name,
    schema,
    schemaVersion,
    migrations = {},
    onMigrationError = 'warn',
    validateAfterMigration = true,
    initialState = []
  } = config

  // Validate migration table
  const validation = validateMigrationTable(migrations, schemaVersion)
  if (!validation.valid) {
    throw new Error(
      `Invalid migration table for collection '${name}': missing migrations for versions ${validation.missing.join(', ')}`
    )
  }

  // Initialize versioned data
  let currentVersionedData: VersionedData<T[]> = createVersionedData(initialState, 0)
  
  // Try to load existing data from storage
  const existingData = versionedData.get(name)
  if (existingData) {
    currentVersionedData = existingData
  }

  // Run migrations if needed (eager migration)
  if (needsMigration(currentVersionedData, schemaVersion)) {
    runMigrations(
      currentVersionedData.data,
      getVersion(currentVersionedData),
      schemaVersion,
      migrations,
      {
        collectionName: name,
        errorStrategy: onMigrationError,
        dryRun: false
      }
    ).then((result) => {
      if (result.success && result.data) {
        // Update with migrated data
        const newVersionedData = createVersionedData(result.data, schemaVersion)
        versionedData.set(name, newVersionedData)
        currentVersionedData = newVersionedData
        
        // Log migration results
        if (result.warnings.length > 0) {
          console.log(`[rxDB2] Collection '${name}' migrations:`, result.warnings)
        }
      } else {
        console.error(`[rxDB2] Collection '${name}' migration failed:`, result.errors)
      }
    }).catch((error) => {
      console.error(`[rxDB2] Collection '${name}' migration error:`, error)
    })
  }

  // Create reactive data store
  const data = reactive<T[]>(currentVersionedData.data)

  // Update data when migrations complete
  const updateData = (newData: T[]) => {
    data.set(newData)
    const newVersionedData = createVersionedData(newData, schemaVersion)
    versionedData.set(name, newVersionedData)
  }

  const collection: CollectionWithMigrations<T> = {
    name,
    schema,
    schemaVersion,
    get count() { return data.get().length },

    // Migration operations
    async migrateToVersion(targetVersion: number, dryRun = false): Promise<MigrationResult<T[]>> {
      const currentData = data.get()
      const currentVersion = getVersion(currentVersionedData)
      
      const result = await runMigrations(
        currentData,
        currentVersion,
        targetVersion,
        migrations,
        {
          collectionName: name,
          errorStrategy: onMigrationError,
          dryRun
        }
      )

      if (result.success && result.data && !dryRun) {
        updateData(result.data)
      }

      return result
    },

    getCurrentVersion(): number {
      return getVersion(currentVersionedData)
    },

    getMigrationStatus(): MigrationStatus {
      const currentVersion = getVersion(currentVersionedData)
      return {
        currentVersion,
        targetVersion: schemaVersion,
        needsMigration: currentVersion < schemaVersion,
        lastMigration: currentVersionedData._meta.migratedAt,
        migrationErrors: []
      }
    },

    // CRUD operations (enhanced with validation)
    insert(item: T): void {
      const result = this.tryInsert(item)
      if (!result.success) {
        throw new Error(`Insert failed: ${result.errors?.map(e => e.message).join(', ')}`)
      }
    },

    tryInsert(item: T): InsertResult<T> {
      try {
        const validated = schema.parse(item)
        const existing = data.get().find((d: T) => d.id === validated.id)
        
        if (existing) {
          return {
            success: false,
            errors: [new z.ZodError([{
              code: 'custom',
              message: `Item with id ${validated.id} already exists`,
              path: ['id']
            }])]
          }
        }

        const newData = [...data.get(), validated]
        updateData(newData)
        
        return { success: true, data: validated }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return { success: false, errors: [error] }
        }
        return { success: false, errors: [new z.ZodError([{
          code: 'custom',
          message: error instanceof Error ? error.message : 'Unknown error',
          path: []
        }])] }
      }
    },

    update(id: T['id'], updates: Partial<T>): void {
      const result = this.tryUpdate(id, updates)
      if (!result.success) {
        throw new Error(`Update failed: ${result.errors?.map(e => e.message).join(', ')}`)
      }
    },

    tryUpdate(id: T['id'], updates: Partial<T>): UpdateResult<T> {
      try {
        const currentData = data.get()
        const index = currentData.findIndex((item: T) => item.id === id)
        
        if (index === -1) {
          return {
            success: false,
            errors: [new z.ZodError([{
              code: 'custom',
              message: `Item with id ${id} not found`,
              path: ['id']
            }])]
          }
        }

        const updatedItem = { ...currentData[index], ...updates }
        const validated = schema.parse(updatedItem)
        
        const newData = [...currentData]
        newData[index] = validated
        updateData(newData)
        
        return { success: true, data: validated }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return { success: false, errors: [error] }
        }
        return { success: false, errors: [new z.ZodError([{
          code: 'custom',
          message: error instanceof Error ? error.message : 'Unknown error',
          path: []
        }])] }
      }
    },

    delete(id: T['id']): void {
      const result = this.tryDelete(id)
      if (!result.success) {
        throw new Error(`Delete failed: ${result.error}`)
      }
    },

    tryDelete(id: T['id']): DeleteResult<T> {
      const currentData = data.get()
      const index = currentData.findIndex((item: T) => item.id === id)
      
      if (index === -1) {
        return {
          success: false,
          error: `Item with id ${id} not found`
        }
      }

      const deletedItem = currentData[index]
      const newData = currentData.filter((_, i) => i !== index)
      updateData(newData)
      
      return { success: true, data: deletedItem }
    },

    find(filter?: Partial<T>): T[] {
      const items = data.get()
      if (!filter) return items
      
      return items.filter(item => {
        return Object.entries(filter).every(([key, value]) => {
          return (item as any)[key] === value
        })
      })
    },

    findOne(filter?: Partial<T>): T | undefined {
      return this.find(filter)[0]
    }
  }

  // Register collection
  collections.set(name, collection)
  
  return collection
}

// Utility functions
export function getCollectionWithMigrations<T>(name: string): CollectionWithMigrations<T> | undefined {
  return collections.get(name)
}

export function getAllCollections(): CollectionWithMigrations<any>[] {
  return Array.from(collections.values())
}

// Alias for semantic clarity
export const defineStore = defineCollectionWithMigrations 