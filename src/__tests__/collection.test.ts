import { describe, it, expect } from "vitest"
import { defineCollection } from "../core/collection"
import { z } from "zod"

describe("defineCollection", () => {
  it("infers document type from schema", () => {
    const schema = z.object({
      id: z.string(),
      name: z.string()
    })

    const Users = defineCollection("users", schema)

    type User = typeof Users.Document

    const sample: User = {
      id: "abc",
      name: "Jeff"
    }

    expect(sample.name).toBe("Jeff")
  })
}) 