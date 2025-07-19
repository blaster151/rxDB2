// tests/utils.ts
import { z } from "zod"
import { defineCollection } from "../src/core/collection"
import { createDatabase } from "../src/core/db"

export const fixedDate = new Date("2025-01-01T00:00:00Z")

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const Notes = defineCollection("notes", NoteSchema)

export const makeTestDB = () => {
  return createDatabase({ notes: Notes })
} 