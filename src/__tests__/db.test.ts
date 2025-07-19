import { describe, it, expect } from "vitest"
import { z } from "zod"
import { defineCollection } from "../core/collection"
import { createDatabase } from "../core/db"

const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
})

const Notes = defineCollection("notes", NoteSchema)

describe("createDatabase + insert + findAll", () => {
  it("inserts and returns documents", async () => {
    const db = createDatabase({ notes: Notes })

    const note = await db.notes.insert({
      id: "1",
      title: "Hello",
      content: "World",
      tags: [],
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01")
    })

    const all = await db.notes.findAll()

    expect(all.length).toBe(1)
    expect(all[0].title).toBe("Hello")
    expect(note.content).toBe("World")
  })

  it("throws on invalid insert", async () => {
    const db = createDatabase({ notes: Notes })

    await expect(() =>
      db.notes.insert({
        id: "1",
        title: "Bad Note",
        // missing content
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
    ).rejects.toThrow()
  })
}) 