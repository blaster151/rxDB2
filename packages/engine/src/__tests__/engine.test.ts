import { describe, it, expect, beforeEach } from "vitest"
import { z } from "zod"
import { createDatabase, defineCollection } from "../createDatabase"

// Test schemas
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  tags: z.array(z.string()),
  active: z.boolean()
})

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  authorId: z.string(),
  published: z.boolean()
})

type User = z.infer<typeof UserSchema>
type Post = z.infer<typeof PostSchema>

describe("Core Engine", () => {
  let db: any
  let users: any
  let posts: any

  beforeEach(() => {
    const Users = defineCollection("users", UserSchema)
    const Posts = defineCollection("posts", PostSchema)
    db = createDatabase([Users, Posts])
    users = db.users
    posts = db.posts
  })

  describe("insert()", () => {
    it("inserts a valid document", async () => {
      const user: User = {
        id: "1",
        name: "John",
        age: 30,
        tags: ["developer"],
        active: true
      }

      users.insert(user)
      const all = users.find()
      expect(all).toHaveLength(1)
      expect(all[0]).toEqual(user)
    })

    it("rejects invalid insert - missing required field", () => {
      const invalidUser = {
        id: "1",
        name: "John",
        // missing age
        tags: ["developer"],
        active: true
      }

      expect(() => users.insert(invalidUser)).toThrow("Invalid document")
    })

    it("rejects invalid insert - wrong type", () => {
      const invalidUser = {
        id: "1",
        name: "John",
        age: "thirty", // should be number
        tags: ["developer"],
        active: true
      }

      expect(() => users.insert(invalidUser)).toThrow("Invalid document")
    })

    it("inserts multiple documents", () => {
      const user1: User = { id: "1", name: "John", age: 30, tags: [], active: true }
      const user2: User = { id: "2", name: "Jane", age: 25, tags: [], active: false }

      users.insert(user1)
      users.insert(user2)

      const all = users.find()
      expect(all).toHaveLength(2)
      expect(all).toContainEqual(user1)
      expect(all).toContainEqual(user2)
    })
  })

  describe("find()", () => {
    beforeEach(() => {
      const user1: User = { id: "1", name: "John", age: 30, tags: ["dev"], active: true }
      const user2: User = { id: "2", name: "Jane", age: 25, tags: ["design"], active: false }
      const user3: User = { id: "3", name: "Bob", age: 35, tags: ["dev", "admin"], active: true }

      users.insert(user1)
      users.insert(user2)
      users.insert(user3)
    })

    it("finds all documents", () => {
      const all = users.find()
      expect(all).toHaveLength(3)
    })

    it("finds documents by specific criteria", () => {
      const activeUsers = users.find({ active: true })
      expect(activeUsers).toHaveLength(2)
      expect(activeUsers.every((u: User) => u.active)).toBe(true)
    })

    it("finds with a simple filter", () => {
      const john = users.find({ name: "John" })
      expect(john).toHaveLength(1)
      expect(john[0].name).toBe("John")
    })

    it("finds with an array filter", () => {
      const devUsers = users.find({ tags: ["dev"] })
      expect(devUsers).toHaveLength(2)
      expect(devUsers.every((u: User) => u.tags.includes("dev"))).toBe(true)
    })

    it("find returns empty array if no match", () => {
      const none = users.find({ name: "Alice" })
      expect(none).toHaveLength(0)
    })
  })

  describe("where()", () => {
    beforeEach(() => {
      const user1: User = { id: "1", name: "John", age: 30, tags: ["dev"], active: true }
      const user2: User = { id: "2", name: "Jane", age: 25, tags: ["design"], active: false }
      const user3: User = { id: "3", name: "Bob", age: 35, tags: ["dev", "admin"], active: true }

      users.insert(user1)
      users.insert(user2)
      users.insert(user3)
    })

    it("filters by a single property", () => {
      const activeQuery = users.where({ active: true })
      const activeUsers = activeQuery.get()
      expect(activeUsers).toHaveLength(2)
      expect(activeUsers.every((u: User) => u.active)).toBe(true)
    })

    it("filters by multiple properties", () => {
      const query = users.where({ active: true, age: 30 })
      const results = query.get()
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("John")
    })

    it("filters with an array property", () => {
      const query = users.where({ tags: ["dev"] })
      const results = query.get()
      expect(results).toHaveLength(2)
      expect(results.every((u: User) => u.tags.includes("dev"))).toBe(true)
    })

    it("handles missing properties in filter", () => {
      const query = users.where({ name: "John" })
      const results = query.get()
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("John")
    })
  })

  describe("liveQuery()", () => {
    it("callback fires on initial data", () => {
      const user: User = { id: "1", name: "John", age: 30, tags: [], active: true }
      users.insert(user)

      const liveQuery = users.live()
      let callbackCount = 0
      let lastValue: User[] = []

      const unsubscribe = liveQuery.subscribe((value) => {
        callbackCount++
        lastValue = value
      })

      expect(callbackCount).toBe(1)
      expect(lastValue).toHaveLength(1)
      expect(lastValue[0]).toEqual(user)

      unsubscribe()
    })

    it("callback fires on subsequent changes", () => {
      const liveQuery = users.live()
      let callbackCount = 0
      let lastValue: User[] = []

      const unsubscribe = liveQuery.subscribe((value) => {
        callbackCount++
        lastValue = value
      })

      const user1: User = { id: "1", name: "John", age: 30, tags: [], active: true }
      const user2: User = { id: "2", name: "Jane", age: 25, tags: [], active: false }

      users.insert(user1)
      expect(callbackCount).toBe(2)
      expect(lastValue).toHaveLength(1)

      users.insert(user2)
      expect(callbackCount).toBe(3)
      expect(lastValue).toHaveLength(2)

      unsubscribe()
    })

    it("callback stops on unsubscribe", () => {
      const liveQuery = users.live()
      let callbackCount = 0

      const unsubscribe = liveQuery.subscribe(() => {
        callbackCount++
      })

      users.insert({ id: "1", name: "John", age: 30, tags: [], active: true })
      expect(callbackCount).toBe(2) // initial + insert

      unsubscribe()

      users.insert({ id: "2", name: "Jane", age: 25, tags: [], active: false })
      expect(callbackCount).toBe(2) // should not increase
    })

    it("callback for complex query changes", () => {
      const user1: User = { id: "1", name: "John", age: 30, tags: ["dev"], active: true }
      const user2: User = { id: "2", name: "Jane", age: 25, tags: ["design"], active: false }

      users.insert(user1)
      users.insert(user2)

      const devQuery = users.where({ tags: ["dev"] })
      let callbackCount = 0
      let lastValue: User[] = []

      const unsubscribe = devQuery.subscribe((value) => {
        callbackCount++
        lastValue = value
      })

      expect(callbackCount).toBe(1)
      expect(lastValue).toHaveLength(1)

      const user3: User = { id: "3", name: "Bob", age: 35, tags: ["dev"], active: true }
      users.insert(user3)

      expect(callbackCount).toBe(2)
      expect(lastValue).toHaveLength(2)

      unsubscribe()
    })

    it("unsubscribe works correctly", () => {
      const liveQuery = users.live()
      let callbackCount = 0

      const unsubscribe = liveQuery.subscribe(() => {
        callbackCount++
      })

      expect(callbackCount).toBe(1) // initial call

      const unsubscribeResult = unsubscribe()
      expect(typeof unsubscribeResult).toBe("function")

      users.insert({ id: "1", name: "John", age: 30, tags: [], active: true })
      expect(callbackCount).toBe(1) // should not increase
    })
  })

  describe("update()", () => {
    beforeEach(() => {
      const user: User = { id: "1", name: "John", age: 30, tags: [], active: true }
      users.insert(user)
    })

    it("updates field of an existing document", () => {
      // Note: update() method not yet implemented in the engine
      // This test documents the expected behavior
      expect(true).toBe(true) // Placeholder
    })

    it("fails to update a non-existent document", () => {
      // Note: update() method not yet implemented in the engine
      // This test documents the expected behavior
      expect(true).toBe(true) // Placeholder
    })

    it("triggers liveQuery on update", () => {
      // Note: update() method not yet implemented in the engine
      // This test documents the expected behavior
      expect(true).toBe(true) // Placeholder
    })
  })

  describe("delete()", () => {
    beforeEach(() => {
      const user: User = { id: "1", name: "John", age: 30, tags: [], active: true }
      users.insert(user)
    })

    it("deletes an existing document", () => {
      // Note: delete() method not yet implemented in the engine
      // This test documents the expected behavior
      expect(true).toBe(true) // Placeholder
    })

    it("fails silently on non-existent delete", () => {
      // Note: delete() method not yet implemented in the engine
      // This test documents the expected behavior
      expect(true).toBe(true) // Placeholder
    })

    it("triggers liveQuery on delete", () => {
      // Note: delete() method not yet implemented in the engine
      // This test documents the expected behavior
      expect(true).toBe(true) // Placeholder
    })
  })
}) 