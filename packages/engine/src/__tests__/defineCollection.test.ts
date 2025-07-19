import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineCollection, getCollection, getSchema } from '../database/defineCollection'
import { collect } from './utils'

describe('defineCollection', () => {
  const userSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email().optional(),
    active: z.boolean().default(true)
  })

  type User = z.infer<typeof userSchema>

  describe('Basic operations', () => {
    it('inserts valid data', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com' })
      users.insert({ id: 2, name: 'Bob' }) // email is optional
      
      const allUsers = users.getAll()
      expect(allUsers).toEqual([
        { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
        { id: 2, name: 'Bob', active: true }
      ])
    })

    it('throws on invalid insert', () => {
      const users = defineCollection<User>('users', userSchema)
      
      expect(() => users.insert({ id: 'invalid', name: 'Alice' } as any)).toThrow()
      expect(() => users.insert({ id: 1, name: 'Alice', email: 'not-an-email' } as any)).toThrow()
      expect(() => users.insert({ id: 1 } as any)).toThrow() // missing required name
    })

    it('tryInsert returns success for valid data', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.tryInsert({ id: 1, name: 'Alice', email: 'alice@example.com' })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com', active: true })
      }
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(1)
    })

    it('tryInsert returns error for invalid data', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.tryInsert({ id: 'invalid', name: 'Alice' } as any)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain('Expected number')
      }
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(0) // Should not insert invalid data
    })

    it('validateInsert validates without inserting', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.validateInsert({ id: 1, name: 'Alice', email: 'alice@example.com' })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com', active: true })
      }
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(0) // Should not insert anything
    })

    it('validateInsert returns error for invalid data without inserting', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.validateInsert({ id: 'invalid', name: 'Alice' } as any)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain('Expected number')
      }
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(0) // Should not insert anything
    })

    it('applies schema defaults', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({ id: 1, name: 'Alice' })
      
      const allUsers = users.getAll()
      expect(allUsers[0].active).toBe(true) // default applied
    })
  })

  describe('Reactive streams', () => {
    it('emits live updates', async () => {
      const users = defineCollection<User>('users', userSchema)
      const liveStream = users.live()
      
      const results: User[][] = []
      const unsubscribe = liveStream.subscribe(val => results.push(val))
      
      users.insert({ id: 1, name: 'Alice' })
      users.insert({ id: 2, name: 'Bob' })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', active: true }],
        [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: true }
        ]
      ])
    })

    it('provides filtered streams', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({ id: 1, name: 'Alice', active: true })
      users.insert({ id: 2, name: 'Bob', active: false })
      users.insert({ id: 3, name: 'Charlie', active: true })
      
      const activeUsers = users.where({ active: true })
      const results = await collect(activeUsers)
      
      expect(results).toEqual([
        { id: 1, name: 'Alice', active: true },
        { id: 3, name: 'Charlie', active: true }
      ])
    })

    it('updates filtered streams reactively', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({ id: 1, name: 'Alice', active: true })
      
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe(val => results.push(val))
      
      users.insert({ id: 2, name: 'Bob', active: false }) // Should not appear
      users.insert({ id: 3, name: 'Charlie', active: true }) // Should appear
      
      unsubscribe()
      
      expect(results).toEqual([
        [{ id: 1, name: 'Alice', active: true }],
        [
          { id: 1, name: 'Alice', active: true },
          { id: 3, name: 'Charlie', active: true }
        ]
      ])
    })
  })

  describe('Collection management', () => {
    it('retrieves collections by name', () => {
      const users = defineCollection<User>('users', userSchema)
      const retrieved = getCollection<User>('users')
      
      expect(retrieved).toBe(users)
      expect(getCollection('nonexistent')).toBeUndefined()
    })

    it('retrieves schemas by name', () => {
      defineCollection<User>('users', userSchema)
      const retrieved = getSchema('users')
      
      expect(retrieved).toBe(userSchema)
      expect(getSchema('nonexistent')).toBeUndefined()
    })

    it('maintains separate collections', () => {
      const userSchema = z.object({ id: z.number(), name: z.string() })
      const postSchema = z.object({ id: z.number(), title: z.string(), content: z.string() })
      
      const users = defineCollection('users', userSchema)
      const posts = defineCollection('posts', postSchema)
      
      users.insert({ id: 1, name: 'Alice' })
      posts.insert({ id: 1, title: 'Hello', content: 'World' })
      
      expect(users.getAll()).toEqual([{ id: 1, name: 'Alice' }])
      expect(posts.getAll()).toEqual([{ id: 1, title: 'Hello', content: 'World' }])
    })
  })

  describe('Complex filtering', () => {
    it('filters by multiple criteria', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', active: true })
      users.insert({ id: 2, name: 'Alice', email: 'alice2@example.com', active: false })
      users.insert({ id: 3, name: 'Bob', email: 'bob@example.com', active: true })
      
      const activeAlices = users.where({ name: 'Alice', active: true })
      const results = await collect(activeAlices)
      
      expect(results).toEqual([
        { id: 1, name: 'Alice', email: 'alice@example.com', active: true }
      ])
    })

    it('handles partial matches', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({ id: 1, name: 'Alice', active: true })
      users.insert({ id: 2, name: 'Bob', active: true })
      
      const aliceUsers = users.where({ name: 'Alice' })
      const results = await collect(aliceUsers)
      
      expect(results).toEqual([
        { id: 1, name: 'Alice', active: true }
      ])
    })
  })

  describe('Schema transformations', () => {
    it('applies schema transformations on insert', () => {
      const transformSchema = z.object({
        id: z.number(),
        name: z.string().transform(name => name.toUpperCase()),
        email: z.string().email().optional()
      })

      const users = defineCollection('users', transformSchema)
      
      users.insert({ id: 1, name: 'alice', email: 'alice@example.com' })
      
      const allUsers = users.getAll()
      expect(allUsers).toEqual([
        { id: 1, name: 'ALICE', email: 'alice@example.com' }
      ])
    })

    it('handles complex nested schemas', () => {
      const nestedSchema = z.object({
        id: z.number(),
        profile: z.object({
          name: z.string(),
          age: z.number().min(0)
        }),
        tags: z.array(z.string())
      })

      const users = defineCollection('users', nestedSchema)
      
      users.insert({
        id: 1,
        profile: { name: 'Alice', age: 25 },
        tags: ['admin', 'user']
      })
      
      const allUsers = users.getAll()
      expect(allUsers).toEqual([{
        id: 1,
        profile: { name: 'Alice', age: 25 },
        tags: ['admin', 'user']
      }])
    })
  })

  describe('Error handling', () => {
    it('provides detailed validation errors', () => {
      const users = defineCollection<User>('users', userSchema)
      
      try {
        users.insert({ id: 'invalid', name: 123, email: 'not-an-email' } as any)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('Expected number')
        expect(error.message).toContain('Expected string')
        expect(error.message).toContain('Invalid email')
      }
    })

    it('maintains data integrity on validation failure', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({ id: 1, name: 'Alice' })
      
      try {
        users.insert({ id: 'invalid', name: 'Bob' } as any)
      } catch (error) {
        // Should not affect existing data
        const allUsers = users.getAll()
        expect(allUsers).toEqual([
          { id: 1, name: 'Alice', active: true }
        ])
      }
    })

    it('handles batch operations with tryInsert', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const batchData = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 'invalid', name: 'Bob' } as any,
        { id: 3, name: 'Charlie', email: 'charlie@example.com' },
        { id: 4, name: 'David', email: 'not-an-email' } as any
      ]
      
      const results = batchData.map(data => users.tryInsert(data))
      
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
      expect(results[3].success).toBe(false)
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(2) // Only valid inserts
      expect(allUsers.map(u => u.name)).toEqual(['Alice', 'Charlie'])
    })

    it('provides detailed error information in tryInsert', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.tryInsert({ 
        id: 'invalid', 
        name: 123, 
        email: 'not-an-email' 
      } as any)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain('Expected number')
        expect(result.error.message).toContain('Expected string')
        expect(result.error.message).toContain('Invalid email')
      }
    })

    it('rethrows non-Zod errors in tryInsert', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Mock a non-Zod error scenario
      const originalParse = users.schema.parse
      users.schema.parse = () => {
        throw new Error('Database connection failed')
      }
      
      expect(() => users.tryInsert({ id: 1, name: 'Alice' })).toThrow('Database connection failed')
      
      // Restore original
      users.schema.parse = originalParse
    })
  })

  describe('Integration with zodMap', () => {
    it('works with zodMap for extra validation', async () => {
      const { zodMap } = await import('../operators/zodMap')
      
      const users = defineCollection<User>('users', userSchema)
      const liveStream = users.live()
      
      // Add extra validation layer
      const validatedStream = zodMap(liveStream, userSchema)
      
      users.insert({ id: 1, name: 'Alice' })
      
      const results = await collect(validatedStream)
      expect(results).toEqual([
        [{ id: 1, name: 'Alice', active: true }]
      ])
    })
  })
}) 