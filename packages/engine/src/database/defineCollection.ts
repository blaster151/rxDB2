import { z, ZodSchema, ZodError } from 'zod'
import { reactive } from '../reactive'

export type InsertResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError | string }

export type UpdateResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError | string }

export type DeleteResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface Collection<T> {
  insert: (item: unknown) => void
  tryInsert: (item: unknown) => InsertResult<T>
  validateInsert: (item: unknown) => InsertResult<T>
  update: (id: any, updates: Partial<T>) => UpdateResult<T>
  tryUpdate: (id: any, updates: Partial<T>) => UpdateResult<T>
  delete: (id: any) => DeleteResult<T>
  tryDelete: (id: any) => DeleteResult<T>
  getAll: () => T[]
  live: () => any // Returns reactive stream of all items
  where: (filter: Partial<T>) => any // Returns filtered reactive stream
  schema: ZodSchema<T> // Expose schema for validation
}

const internalDb = new Map<string, any>()
const collectionSchemas = new Map<string, ZodSchema>()

export function defineCollection<T>(name: string, schema: ZodSchema<T>): Collection<T> {
  collectionSchemas.set(name, schema)
  const data: T[] = []
  const dataStream = reactive(data)

  const collection: Collection<T> = {
    insert: (item: unknown) => {
      const parsed = schema.parse(item)
      
      // Check for duplicate ID
      const existingIndex = data.findIndex(existing => (existing as any).id === (parsed as any).id)
      if (existingIndex !== -1) {
        throw new Error(`Item with id ${(parsed as any).id} already exists`)
      }
      
      data.push(parsed)
      dataStream.set([...data]) // Update reactive stream
    },
    tryInsert: (item: unknown): InsertResult<T> => {
      try {
        const parsed = schema.parse(item)
        
        // Check for duplicate ID
        const existingIndex = data.findIndex(existing => (existing as any).id === (parsed as any).id)
        if (existingIndex !== -1) {
          return { success: false, error: `Item with id ${(parsed as any).id} already exists` }
        }
        
        data.push(parsed)
        dataStream.set([...data]) // Update reactive stream
        return { success: true, data: parsed }
      } catch (err) {
        if (err instanceof ZodError) {
          return { success: false, error: err }
        }
        throw err // rethrow non-Zod errors
      }
    },
    validateInsert: (item: unknown): InsertResult<T> => {
      try {
        const parsed = schema.parse(item)
        
        // Check for duplicate ID (validation only, don't insert)
        const existingIndex = data.findIndex(existing => (existing as any).id === (parsed as any).id)
        if (existingIndex !== -1) {
          return { success: false, error: `Item with id ${(parsed as any).id} already exists` }
        }
        
        return { success: true, data: parsed }
      } catch (err) {
        if (err instanceof ZodError) {
          return { success: false, error: err }
        }
        throw err // rethrow non-Zod errors
      }
    },
    update: (id: any, updates: Partial<T>) => {
      const index = data.findIndex(item => (item as any).id === id)
      if (index === -1) {
        throw new Error(`Item with id ${id} not found`)
      }
      
      const updatedItem = { ...data[index], ...updates }
      const parsed = schema.parse(updatedItem)
      data[index] = parsed
      dataStream.set([...data]) // Update reactive stream
      return { success: true, data: parsed }
    },
    tryUpdate: (id: any, updates: Partial<T>): UpdateResult<T> => {
      try {
        const index = data.findIndex(item => (item as any).id === id)
        if (index === -1) {
          return { success: false, error: `Item with id ${id} not found` }
        }
        
        const updatedItem = { ...data[index], ...updates }
        const parsed = schema.parse(updatedItem)
        data[index] = parsed
        dataStream.set([...data]) // Update reactive stream
        return { success: true, data: parsed }
      } catch (err) {
        if (err instanceof ZodError) {
          return { success: false, error: err }
        }
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    delete: (id: any) => {
      const index = data.findIndex(item => (item as any).id === id)
      if (index === -1) {
        throw new Error(`Item with id ${id} not found`)
      }
      
      const deletedItem = data[index]
      data.splice(index, 1)
      dataStream.set([...data]) // Update reactive stream
      return { success: true, data: deletedItem }
    },
    tryDelete: (id: any): DeleteResult<T> => {
      const index = data.findIndex(item => (item as any).id === id)
      if (index === -1) {
        return { success: false, error: `Item with id ${id} not found` }
      }
      
      const deletedItem = data[index]
      data.splice(index, 1)
      dataStream.set([...data]) // Update reactive stream
      return { success: true, data: deletedItem }
    },
    getAll: () => [...data],
    live: () => dataStream,
    where: (filter: Partial<T>) => {
      const filtered = data.filter(item => {
        return Object.entries(filter).every(([key, value]) => 
          item[key as keyof T] === value
        )
      })
      const filteredStream = reactive(filtered)
      
      // Subscribe to data changes and update filtered stream
      dataStream.subscribe(allData => {
        const newFiltered = allData.filter(item => {
          return Object.entries(filter).every(([key, value]) => 
            item[key as keyof T] === value
          )
        })
        filteredStream.set(newFiltered)
      })
      
      return filteredStream
    },
    schema // Expose schema for external validation
  }

  internalDb.set(name, collection)
  return collection
}

export function getCollection<T>(name: string): Collection<T> | undefined {
  return internalDb.get(name)
}

export function getSchema(name: string): ZodSchema | undefined {
  return collectionSchemas.get(name)
} 