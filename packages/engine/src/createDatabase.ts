import { z } from 'zod'
import { createObservable } from './createObservable'
import { filterDocs } from './query'

export function defineCollection<T extends Record<string, any>>(name: string, schema: z.ZodSchema<T>) {
  return { name, schema }
}

export function createDatabase(collections: ReturnType<typeof defineCollection>[]) {
  const db: Record<string, any> = {}

  for (const { name, schema } of collections) {
    const docs: T[] = []
    const observable = createObservable<T[]>([])

    db[name] = {
      insert: (doc: T) => {
        const result = schema.safeParse(doc)
        if (!result.success) throw new Error(`Invalid document: ${result.error.message}`)
        docs.push(doc)
        observable.set([...docs])
      },
      find: (where?: Partial<T>) => where ? filterDocs(docs, where) : [...docs],
      where: (filter: Partial<T>) => {
        const initial = filterDocs(docs, filter)
        const filtered = createObservable<T[]>(initial)
        observable.subscribe(all => filtered.set(filterDocs(all, filter)))
        return filtered
      },
      live: () => observable,
    }
  }

  return db
} 