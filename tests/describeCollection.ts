// tests/describeCollection.ts
import { describe, it, expect } from "vitest"
import { CollectionDefinition } from "../src/core/collection"
import { createDatabase } from "../src/core/db"

export function describeCollection<Name extends string, Schema>(
  label: string,
  collection: CollectionDefinition<Name, Schema>,
  sample: any
) {
  describe(label, () => {
    it("inserts valid documents", async () => {
      const db = createDatabase({ [collection.name]: collection } as any)
      const inserted = await db[collection.name].insert(sample)
      expect(inserted).toMatchObject(sample)
    })

    it("rejects invalid documents", async () => {
      const db = createDatabase({ [collection.name]: collection } as any)
      const invalid = { ...sample }
      delete (invalid as any).id
      await expect(() => db[collection.name].insert(invalid as any)).rejects.toThrow()
    })
  })
} 