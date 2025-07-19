import { CollectionDefinition } from "./collection"

type CollectionInstance<Doc> = {
  insert(doc: Doc): Promise<Doc>
  findAll(): Promise<Doc[]>
}

export type Database<
  Defs extends Record<string, CollectionDefinition<any, any>>
> = {
  [K in keyof Defs]: CollectionInstance<Defs[K]["Document"]>
}

export function createDatabase<
  Defs extends Record<string, CollectionDefinition<any, any>>
>(defs: Defs): Database<Defs> {
  const db: Partial<Database<Defs>> = {}

  for (const key in defs) {
    const def = defs[key]
    const collection: any[] = []

    db[key] = {
      async insert(doc) {
        const parsed = def.schema.parse(doc)
        collection.push(parsed)
        return parsed
      },
      async findAll() {
        return [...collection]
      }
    }
  }

  return db as Database<Defs>
} 