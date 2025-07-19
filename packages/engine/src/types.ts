export type Document = Record<string, any>

export type CollectionSchema<T extends Document> = {
  name: string
  schema: any // Zod.ZodSchema<T> - will import zod when needed
}

export type Collection<T extends Document> = {
  insert: (doc: T) => void
  find: (where?: Partial<T>) => T[]
  where: (filter: Partial<T>) => LiveQuery<T[]>
  live: () => LiveQuery<T[]>
}

export type Database = {
  [collection: string]: Collection<any>
}

export interface LiveQuery<T> {
  get: () => T
  subscribe: (cb: (value: T) => void) => () => void
} 