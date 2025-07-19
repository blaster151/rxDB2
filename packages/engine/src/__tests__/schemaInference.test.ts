import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { defineCollection } from '../database/defineCollection'
import { collect } from './utils'

describe('Schema Inference and Type Safety', () => {
  // Define complex schemas to test inference
  const userSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(0),
    active: z.boolean().default(true),
    role: z.enum(['admin', 'user', 'guest']).default('user'),
    metadata: z.object({
      lastLogin: z.date().optional(),
      preferences: z.record(z.string(), z.unknown()).default({})
    }).optional(),
    tags: z.array(z.string()).default([])
  })

  const postSchema = z.object({
    id: z.number(),
    title: z.string().min(1),
    content: z.string(),
    authorId: z.number(),
    published: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    createdAt: z.date(),
    updatedAt: z.date().optional()
  })

  type User = z.infer<typeof userSchema>
  type Post = z.infer<typeof postSchema>

  describe('Collection Type Inference', () => {
    it('should infer correct types from schema', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // TypeScript should infer the correct type
      const user: User = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        active: true,
        role: 'admin',
        metadata: {
          lastLogin: new Date(),
          preferences: { theme: 'dark' }
        },
        tags: ['developer', 'admin']
      }

      // This should compile without type errors
      users.insert(user)
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(1)
      expect(allUsers[0]).toEqual(user)
    })

    it('should provide type-safe insert methods', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Test that TypeScript catches type errors at compile time
      // Note: These would cause TypeScript errors if uncommented:
      // users.insert({ id: 'not-a-number', name: 'Alice' }) // Should be type error
      // users.insert({ id: 1, name: 'Alice', email: 'invalid-email' }) // Should be type error
      // users.insert({ id: 1, name: 'Alice', role: 'invalid-role' }) // Should be type error
      
      // Valid insert should work
      const result = users.tryInsert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      expect(result.success).toBe(true)
      if (result.success) {
        // TypeScript should know this is User type
        expect(result.data.id).toBe(1)
        expect(result.data.name).toBe('Alice')
        expect(result.data.email).toBe('alice@example.com')
        expect(result.data.age).toBe(25)
        expect(result.data.active).toBe(true) // default value
        expect(result.data.role).toBe('user') // default value
        expect(result.data.tags).toEqual([]) // default value
      }
    })

    it('should maintain type safety in getAll()', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin'
      })
      
      const allUsers = users.getAll()
      
      // TypeScript should know this is User[]
      expect(Array.isArray(allUsers)).toBe(true)
      expect(allUsers).toHaveLength(1)
      
      const user = allUsers[0]
      // TypeScript should know this is User type
      expect(user.id).toBe(1)
      expect(user.name).toBe('Alice')
      expect(user.email).toBe('alice@example.com')
      expect(user.age).toBe(25)
      expect(user.role).toBe('admin')
      expect(user.active).toBe(true) // default value
      expect(user.tags).toEqual([]) // default value
    })
  })

  describe('Reactive Stream Type Inference', () => {
    it('should provide strongly typed live queries', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const results: User[][] = []
      
      const unsubscribe = liveQuery.subscribe((users: User[]) => {
        results.push(users)
      })
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin'
      })
      
      unsubscribe()
      
      expect(results).toHaveLength(2) // initial empty + one update
      expect(results[1]).toHaveLength(1)
      
      const user = results[1][0]
      // TypeScript should know this is User type
      expect(user.id).toBe(1)
      expect(user.name).toBe('Alice')
      expect(user.email).toBe('alice@example.com')
      expect(user.age).toBe(25)
      expect(user.role).toBe('admin')
      expect(user.active).toBe(true)
      expect(user.tags).toEqual([])
    })

    it('should provide strongly typed filtered queries', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const adminUsers = users.where({ role: 'admin' })
      const results: User[][] = []
      
      const unsubscribe = adminUsers.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert non-admin user - should not appear in results
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'user'
      })
      
      // Insert admin user - should appear in results
      users.insert({
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        age: 30,
        role: 'admin'
      })
      
      unsubscribe()
      
      expect(results).toHaveLength(3) // initial empty + two updates (one for each insert)
      expect(results[2]).toHaveLength(1) // final result has the admin user
      
      const adminUser = results[2][0]
      // TypeScript should know this is User type
      expect(adminUser.id).toBe(2)
      expect(adminUser.name).toBe('Bob')
      expect(adminUser.role).toBe('admin')
    })

    it('should maintain type safety in reactive transformations', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      
      // Test map transformation with type safety
      const userNames = liveQuery.map((users: User[]) => 
        users.map(user => user.name)
      )
      
      const results: string[][] = []
      const unsubscribe = userNames.subscribe((names: string[]) => {
        results.push(names)
      })
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      users.insert({
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        age: 30
      })
      
      unsubscribe()
      
      expect(results).toHaveLength(3) // initial empty + two updates
      expect(results[2]).toEqual(['Alice', 'Bob'])
    })
  })

  describe('Complex Schema Inference', () => {
    it('should handle nested object types correctly', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const userWithMetadata: User = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        active: true,
        role: 'admin',
        metadata: {
          lastLogin: new Date('2024-01-01'),
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: true
          }
        },
        tags: ['developer', 'admin']
      }
      
      const result = users.tryInsert(userWithMetadata)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const user = result.data
        // TypeScript should know the nested structure
        expect(user.metadata?.lastLogin).toBeInstanceOf(Date)
        expect(user.metadata?.preferences.theme).toBe('dark')
        expect(user.metadata?.preferences.language).toBe('en')
        expect(user.tags).toContain('developer')
        expect(user.tags).toContain('admin')
      }
    })

    it('should handle optional fields with defaults', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert minimal user (should get defaults)
      const result = users.tryInsert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      expect(result.success).toBe(true)
      
      if (result.success) {
        const user = result.data
        // Default values should be applied
        expect(user.active).toBe(true)
        expect(user.role).toBe('user')
        expect(user.tags).toEqual([])
        expect(user.metadata).toBeUndefined()
      }
    })

    it('should handle array types correctly', () => {
      const posts = defineCollection<Post>('posts', postSchema)
      
      const post: Post = {
        id: 1,
        title: 'My First Post',
        content: 'Hello World!',
        authorId: 1,
        published: true,
        tags: ['programming', 'typescript'],
        createdAt: new Date('2024-01-01')
      }
      
      const result = posts.tryInsert(post)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const savedPost = result.data
        // TypeScript should know this is string[]
        expect(Array.isArray(savedPost.tags)).toBe(true)
        expect(savedPost.tags).toContain('programming')
        expect(savedPost.tags).toContain('typescript')
        expect(savedPost.createdAt).toBeInstanceOf(Date)
      }
    })
  })

  describe('Type Safety in Error Handling', () => {
    it('should provide typed error results', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.tryInsert({
        id: 'not-a-number' as any,
        name: 'Alice',
        email: 'invalid-email',
        age: -5 // invalid age
      } as any)
      
      expect(result.success).toBe(false)
      
      if (!result.success) {
        // TypeScript should know this is ZodError
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain('Invalid input: expected number')
      }
    })

    it('should maintain type safety in validation-only operations', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const validUser = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      }
      
      const result = users.validateInsert(validUser)
      expect(result.success).toBe(true)
      
      if (result.success) {
        // TypeScript should know this is User type
        const user = result.data
        expect(user.id).toBe(1)
        expect(user.name).toBe('Alice')
        expect(user.email).toBe('alice@example.com')
        expect(user.age).toBe(25)
        expect(user.active).toBe(true) // default
        expect(user.role).toBe('user') // default
      }
    })
  })

  describe('Integration with Reactive Operators', () => {
    it('should maintain types through operator chains', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      
      // Chain multiple operators while maintaining type safety
      const activeAdminUsers = liveQuery
        .map((users: User[]) => users.filter(user => user.active && user.role === 'admin'))
        .map((users: User[]) => users.map(user => ({ 
          id: user.id, 
          name: user.name, 
          email: user.email 
        })))
      
      const results: Array<{ id: number; name: string; email: string }>[] = []
      const unsubscribe = activeAdminUsers.subscribe((users) => {
        results.push(users)
      })
      
      // Insert various users
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        active: true,
        role: 'admin'
      })
      
      users.insert({
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        age: 30,
        active: false, // inactive
        role: 'admin'
      })
      
      users.insert({
        id: 3,
        name: 'Charlie',
        email: 'charlie@example.com',
        age: 35,
        active: true,
        role: 'user' // not admin
      })
      
      unsubscribe()
      
      expect(results).toHaveLength(4) // initial empty + three updates (one for each insert)
      expect(results[3]).toHaveLength(1) // only Alice matches
      
      const filteredUser = results[3][0]
      // TypeScript should know this is the transformed type
      expect(filteredUser.id).toBe(1)
      expect(filteredUser.name).toBe('Alice')
      expect(filteredUser.email).toBe('alice@example.com')
      // Should not have age, role, etc. due to transformation
    })
  })

  describe('Type Safety Verification', () => {
    it('should verify that collections return strongly typed objects', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Test that getAll returns User[]
      const allUsers = users.getAll()
      expect(Array.isArray(allUsers)).toBe(true)
      
      if (allUsers.length > 0) {
        const user = allUsers[0]
        // Verify all expected properties exist with correct types
        expect(typeof user.id).toBe('number')
        expect(typeof user.name).toBe('string')
        expect(typeof user.email).toBe('string')
        expect(typeof user.age).toBe('number')
        expect(typeof user.active).toBe('boolean')
        expect(['admin', 'user', 'guest']).toContain(user.role)
        expect(Array.isArray(user.tags)).toBe(true)
      }
    })

    it('should verify reactive streams maintain type information', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const result = await collect(liveQuery)
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      
      const emission = result[0] as User[]
      expect(Array.isArray(emission)).toBe(true)
      
      if (emission.length > 0) {
        const user = emission[0]
        // Verify type safety in reactive emissions
        expect(typeof user.id).toBe('number')
        expect(typeof user.name).toBe('string')
        expect(typeof user.email).toBe('string')
        expect(typeof user.age).toBe('number')
        expect(typeof user.active).toBe('boolean')
        expect(['admin', 'user', 'guest']).toContain(user.role)
        expect(Array.isArray(user.tags)).toBe(true)
      }
    })
  })
}) 