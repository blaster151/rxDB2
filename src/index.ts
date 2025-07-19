import { defineCollection } from "./core/collection"
import { createDatabase } from "./core/db"
import { z } from "zod"

const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
})

const Notes = defineCollection("notes", NoteSchema)

const db = createDatabase({ notes: Notes })

async function main() {
  await db.notes.insert({
    id: crypto.randomUUID(),
    title: "Hello",
    content: "World",
    tags: ["demo"],
    createdAt: new Date(),
    updatedAt: new Date()
  })

  const notes = await db.notes.findAll()
  console.log(notes)
}

main() 