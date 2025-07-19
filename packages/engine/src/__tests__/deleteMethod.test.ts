import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { defineCollection } from '../database/defineCollection'
import { collect } from './utils'

describe('Delete Method and LiveQuery Integration', () => {
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

  type User = z.infer<typeof userSchema>

  describe('Basic Delete Operations', () => {
    it('should delete existing items', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin'
      })
      
      // Delete user
      const result = users.delete(1)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Alice')
        expect(result.data.email).toBe('alice@example.com')
        expect(result.data.role).toBe('admin')
      }
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(0)
    })

    it('should throw error for non-existent item', () => {
      const users = defineCollection<User>('users', userSchema)
      
      expect(() => users.delete(999)).toThrow('Item with id 999 not found')
    })

    it('should provide safe delete with tryDelete', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Try to delete non-existent item
      const result = users.tryDelete(999)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Item with id 999 not found')
      }
      
      // Insert and then delete
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      const deleteResult = users.tryDelete(1)
      expect(deleteResult.success).toBe(true)
      if (deleteResult.success) {
        expect(deleteResult.data.name).toBe('Alice')
        expect(deleteResult.data.email).toBe('alice@example.com')
      }
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(0)
    })

    it('should handle multiple deletes', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert multiple users
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 })
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30 })
      users.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35 })
      
      expect(users.getAll()).toHaveLength(3)
      
      // Delete middle user
      const result = users.delete(2)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Bob')
      }
      
      expect(users.getAll()).toHaveLength(2)
      expect(users.getAll().map(u => u.name)).toEqual(['Alice', 'Charlie'])
      
      // Delete first user
      users.delete(1)
      expect(users.getAll()).toHaveLength(1)
      expect(users.getAll()[0].name).toBe('Charlie')
      
      // Delete last user
      users.delete(3)
      expect(users.getAll()).toHaveLength(0)
    })
  })

  describe('Delete Triggers LiveQuery Subscriptions', () => {
    it('should trigger live query on delete', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to live query
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin'
      })
      
      // Delete user
      users.delete(1)
      
      unsubscribe()
      
      expect(results).toHaveLength(3) // initial empty + insert + delete
      expect(results[1]).toHaveLength(1) // Alice inserted
      expect(results[2]).toHaveLength(0) // Alice deleted
    })

    it('should trigger filtered query on relevant deletes', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to admin users only
      const adminUsers = users.where({ role: 'admin' })
      const results: User[][] = []
      const unsubscribe = adminUsers.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert admin user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin'
      })
      
      // Insert regular user
      users.insert({
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        age: 30,
        role: 'user'
      })
      
      // Delete admin user - should trigger subscription
      users.delete(1)
      
      // Delete regular user - should NOT trigger admin subscription
      users.delete(2)
      
      unsubscribe()
      
      expect(results).toHaveLength(3) // initial empty + insert admin + delete admin
      expect(results[1]).toHaveLength(1) // Alice admin
      expect(results[2]).toHaveLength(0) // Alice deleted
    })

    it('should handle multiple subscribers to same query', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const activeUsers = users.where({ active: true })
      const results1: User[][] = []
      const results2: User[][] = []
      
      const unsubscribe1 = activeUsers.subscribe((users: User[]) => {
        results1.push(users)
      })
      const unsubscribe2 = activeUsers.subscribe((users: User[]) => {
        results2.push(users)
      })
      
      // Insert active user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        active: true
      })
      
      // Delete active user
      users.delete(1)
      
      unsubscribe1()
      unsubscribe2()
      
      // Both subscribers should get the same results
      expect(results1).toEqual(results2)
      expect(results1).toHaveLength(3) // initial empty + insert + delete
      expect(results1[1]).toHaveLength(1) // Alice active
      expect(results1[2]).toHaveLength(0) // Alice deleted
    })
  })

  describe('Delete with Complex Data Types', () => {
    it('should handle deleting items with nested objects', () => {
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
          preferences: { theme: 'dark', language: 'en' }
        },
        tags: ['developer', 'admin']
      }
      
      users.insert(userWithMetadata)
      
      const result = users.delete(1)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.metadata?.lastLogin).toEqual(new Date('2024-01-01'))
        expect(result.data.metadata?.preferences.theme).toBe('dark')
        expect(result.data.tags).toEqual(['developer', 'admin'])
      }
    })

    it('should handle deleting items with arrays', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        tags: ['developer', 'admin', 'typescript']
      })
      
      const result = users.delete(1)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tags).toEqual(['developer', 'admin', 'typescript'])
      }
    })
  })

  describe('Delete Error Handling', () => {
    it('should handle non-existent item in tryDelete', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.tryDelete(999)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Item with id 999 not found')
      }
    })

    it('should handle deleting from empty collection', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.tryDelete(1)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Item with id 1 not found')
      }
    })
  })

  describe('Delete Performance and Edge Cases', () => {
    it('should handle rapid deletes', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert multiple users
      for (let i = 1; i <= 5; i++) {
        users.insert({
          id: i,
          name: `User${i}`,
          email: `user${i}@example.com`,
          age: 20 + i
        })
      }
      
      // Rapid deletes
      for (let i = 5; i >= 1; i--) {
        users.delete(i)
      }
      
      unsubscribe()
      
      expect(results).toHaveLength(11) // initial empty + 5 inserts + 5 deletes
      expect(results[results.length - 1]).toHaveLength(0) // all deleted
    })

    it('should handle deletes affecting multiple queries', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const activeUsers = users.where({ active: true })
      const adminUsers = users.where({ role: 'admin' })
      
      const activeResults: User[][] = []
      const adminResults: User[][] = []
      
      const unsubscribeActive = activeUsers.subscribe((users: User[]) => {
        activeResults.push(users)
      })
      const unsubscribeAdmin = adminUsers.subscribe((users: User[]) => {
        adminResults.push(users)
      })
      
      // Insert user that matches both queries
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        active: true,
        role: 'admin'
      })
      
      // Delete user - should affect both queries
      users.delete(1)
      
      unsubscribeActive()
      unsubscribeAdmin()
      
      // Both queries should be affected
      expect(activeResults).toHaveLength(3) // initial empty + insert + delete
      expect(adminResults).toHaveLength(3) // initial empty + insert + delete
      
      expect(activeResults[1]).toHaveLength(1) // Alice active
      expect(activeResults[2]).toHaveLength(0) // Alice deleted
      
      expect(adminResults[1]).toHaveLength(1) // Alice admin
      expect(adminResults[2]).toHaveLength(0) // Alice deleted
    })

    it('should handle delete and re-insert scenarios', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Delete user
      users.delete(1)
      
      // Re-insert same user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 26 // different age
      })
      
      unsubscribe()
      
      expect(results).toHaveLength(4) // initial empty + insert + delete + re-insert
      expect(results[1]).toHaveLength(1) // Alice inserted
      expect(results[2]).toHaveLength(0) // Alice deleted
      expect(results[3]).toHaveLength(1) // Alice re-inserted
      expect(results[3][0].age).toBe(26) // updated age
    })
  })

  describe('Delete Integration with Other Operations', () => {
    it('should work with update and delete operations', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        active: true
      })
      
      // Update to inactive
      users.update(1, { active: false })
      
      // Update back to active
      users.update(1, { active: true })
      
      // Delete user
      users.delete(1)
      
      unsubscribe()
      
      expect(results).toHaveLength(5) // initial empty + insert + inactive + active + delete
      expect(results[1]).toHaveLength(1) // Alice active
      expect(results[2]).toHaveLength(0) // Alice inactive
      expect(results[3]).toHaveLength(1) // Alice active again
      expect(results[4]).toHaveLength(0) // Alice deleted
    })

    it('should handle delete after complex updates', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert user with complex data
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        metadata: {
          lastLogin: new Date('2024-01-01'),
          preferences: { theme: 'light' }
        },
        tags: ['developer']
      })
      
      // Update with complex changes
      users.update(1, {
        age: 26,
        metadata: {
          lastLogin: new Date('2024-01-02'),
          preferences: { theme: 'dark', language: 'en' }
        },
        tags: ['developer', 'admin']
      })
      
      // Delete user
      const result = users.delete(1)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.age).toBe(26)
        expect(result.data.metadata?.preferences.theme).toBe('dark')
        expect(result.data.tags).toEqual(['developer', 'admin'])
      }
      
      expect(users.getAll()).toHaveLength(0)
    })
  })
}) 