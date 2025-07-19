import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { defineCollection } from '../database/defineCollection'
import { collect } from './utils'

describe('Update Method and LiveQuery Integration', () => {
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

  describe('Basic Update Operations', () => {
    it('should update existing items', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert initial user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'user'
      })
      
      // Update user
      const result = users.update(1, { 
        name: 'Alice Updated',
        age: 26,
        role: 'admin'
      })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Alice Updated')
        expect(result.data.age).toBe(26)
        expect(result.data.role).toBe('admin')
        expect(result.data.email).toBe('alice@example.com') // unchanged
        expect(result.data.active).toBe(true) // default preserved
      }
      
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(1)
      expect(allUsers[0].name).toBe('Alice Updated')
    })

    it('should throw error for non-existent item', () => {
      const users = defineCollection<User>('users', userSchema)
      
      expect(() => users.update(999, { name: 'Non-existent' })).toThrow('Item with id 999 not found')
    })

    it('should provide safe update with tryUpdate', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Try to update non-existent item
      const result = users.tryUpdate(999, { name: 'Non-existent' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Item with id 999 not found')
      }
      
      // Insert and then update
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      const updateResult = users.tryUpdate(1, { age: 26 })
      expect(updateResult.success).toBe(true)
      if (updateResult.success) {
        expect(updateResult.data.age).toBe(26)
        expect(updateResult.data.name).toBe('Alice') // unchanged
      }
    })

    it('should validate updates against schema', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Try invalid update
      const result = users.tryUpdate(1, { 
        email: 'invalid-email',
        age: -5 // invalid age
      } as any)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        if (result.error instanceof Error) {
          expect(result.error.message).toContain('Invalid email address')
        } else {
          expect(result.error).toContain('Invalid email address')
        }
      }
      
      // Original data should be unchanged
      const allUsers = users.getAll()
      expect(allUsers[0].email).toBe('alice@example.com')
      expect(allUsers[0].age).toBe(25)
    })
  })

  describe('Update Triggers LiveQuery Subscriptions', () => {
    it('should trigger live query on update', async () => {
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
        role: 'user'
      })
      
      // Update user
      users.update(1, { 
        name: 'Alice Updated',
        role: 'admin'
      })
      
      unsubscribe()
      
      expect(results).toHaveLength(3) // initial empty + insert + update
      expect(results[2]).toHaveLength(1)
      
      const updatedUser = results[2][0]
      expect(updatedUser.name).toBe('Alice Updated')
      expect(updatedUser.role).toBe('admin')
      expect(updatedUser.email).toBe('alice@example.com') // unchanged
      expect(updatedUser.age).toBe(25) // unchanged
    })

    it('should trigger filtered query on relevant updates', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to admin users only
      const adminUsers = users.where({ role: 'admin' })
      const results: User[][] = []
      const unsubscribe = adminUsers.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert regular user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'user'
      })
      
      // Update to admin - should trigger subscription
      users.update(1, { role: 'admin' })
      
      // Update name - should trigger subscription (same item)
      users.update(1, { name: 'Alice Admin' })
      
      // Update to user again - should trigger subscription (remove from admin list)
      users.update(1, { role: 'user' })
      
      unsubscribe()
      
      expect(results).toHaveLength(4) // initial empty + 3 updates
      expect(results[1]).toHaveLength(0) // no admins initially
      expect(results[2]).toHaveLength(1) // Alice becomes admin
      expect(results[3]).toHaveLength(1) // Alice still admin, name updated
      expect(results[4]).toHaveLength(0) // Alice no longer admin
      
      // Verify the admin user data
      const adminUser = results[2][0]
      expect(adminUser.name).toBe('Alice')
      expect(adminUser.role).toBe('admin')
    })

    it('should not trigger filtered query on irrelevant updates', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to users by name
      const aliceUsers = users.where({ name: 'Alice' })
      const results: User[][] = []
      const unsubscribe = aliceUsers.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert Alice
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Update age - should NOT trigger since we're not filtering by age
      users.update(1, { age: 26 })
      
      // Update email - should NOT trigger since we're not filtering by email
      users.update(1, { email: 'alice.new@example.com' })
      
      // Update name - should trigger since we're filtering by name
      users.update(1, { name: 'Alice Updated' })
      
      unsubscribe()
      
      expect(results).toHaveLength(3) // initial empty + insert + name update
      expect(results[1]).toHaveLength(1) // Alice initially
      expect(results[2]).toHaveLength(1) // Alice Updated
      
      const finalUser = results[2][0]
      expect(finalUser.name).toBe('Alice Updated')
      expect(finalUser.age).toBe(26) // age was updated but didn't trigger
      expect(finalUser.email).toBe('alice.new@example.com') // email was updated but didn't trigger
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
      
      // Update to inactive
      users.update(1, { active: false })
      
      // Update back to active
      users.update(1, { active: true })
      
      unsubscribe1()
      unsubscribe2()
      
      // Both subscribers should get the same results
      expect(results1).toEqual(results2)
      expect(results1).toHaveLength(4) // initial empty + insert + inactive + active
      expect(results1[1]).toHaveLength(1) // Alice active
      expect(results1[2]).toHaveLength(0) // Alice inactive
      expect(results1[3]).toHaveLength(1) // Alice active again
    })
  })

  describe('Update with Complex Data Types', () => {
    it('should handle nested object updates', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        metadata: {
          lastLogin: new Date('2024-01-01'),
          preferences: { theme: 'light' }
        }
      })
      
      // Update nested metadata
      const result = users.update(1, {
        metadata: {
          lastLogin: new Date('2024-01-02'),
          preferences: { theme: 'dark', language: 'en' }
        }
      })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.metadata?.lastLogin).toEqual(new Date('2024-01-02'))
        expect(result.data.metadata?.preferences.theme).toBe('dark')
        expect(result.data.metadata?.preferences.language).toBe('en')
      }
    })

    it('should handle array updates', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        tags: ['developer']
      })
      
      // Update tags array
      const result = users.update(1, {
        tags: ['developer', 'admin', 'typescript']
      })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tags).toEqual(['developer', 'admin', 'typescript'])
      }
    })

    it('should handle partial updates preserving existing data', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin',
        active: true,
        metadata: {
          lastLogin: new Date('2024-01-01'),
          preferences: { theme: 'light' }
        },
        tags: ['developer']
      })
      
      // Update only specific fields
      const result = users.update(1, {
        age: 26,
        metadata: {
          lastLogin: new Date('2024-01-02'),
          preferences: { theme: 'dark' }
        }
      })
      
      expect(result.success).toBe(true)
      if (result.success) {
        // Updated fields
        expect(result.data.age).toBe(26)
        expect(result.data.metadata?.lastLogin).toEqual(new Date('2024-01-02'))
        expect(result.data.metadata?.preferences.theme).toBe('dark')
        
        // Preserved fields
        expect(result.data.name).toBe('Alice')
        expect(result.data.email).toBe('alice@example.com')
        expect(result.data.role).toBe('admin')
        expect(result.data.active).toBe(true)
        expect(result.data.tags).toEqual(['developer'])
      }
    })
  })

  describe('Update Error Handling', () => {
    it('should handle validation errors in updates', () => {
      const users = defineCollection<User>('users', userSchema)
      
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Try invalid updates
      const result1 = users.tryUpdate(1, { email: 'invalid-email' } as any)
      expect(result1.success).toBe(false)
      
      const result2 = users.tryUpdate(1, { age: -5 } as any)
      expect(result2.success).toBe(false)
      
      const result3 = users.tryUpdate(1, { role: 'invalid-role' } as any)
      expect(result3.success).toBe(false)
      
      // Original data should be unchanged
      const allUsers = users.getAll()
      expect(allUsers[0].email).toBe('alice@example.com')
      expect(allUsers[0].age).toBe(25)
      expect(allUsers[0].role).toBe('user') // default
    })

    it('should handle non-existent item in tryUpdate', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const result = users.tryUpdate(999, { name: 'Non-existent' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Item with id 999 not found')
      }
    })
  })

  describe('Update Performance and Edge Cases', () => {
    it('should handle rapid updates', async () => {
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
      
      // Rapid updates
      for (let i = 1; i <= 10; i++) {
        users.update(1, { age: 25 + i })
      }
      
      unsubscribe()
      
      expect(results).toHaveLength(12) // initial empty + insert + 10 updates
      expect(results[results.length - 1][0].age).toBe(35) // final age
    })

    it('should handle updates to multiple items', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert multiple users
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true })
      users.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: false })
      
      // Update multiple users
      users.update(1, { active: false }) // Remove from active
      users.update(2, { age: 31 }) // Keep in active, just age change
      users.update(3, { active: true }) // Add to active
      
      unsubscribe()
      
      expect(results).toHaveLength(5) // initial empty + 3 inserts + 3 updates
      expect(results[4]).toHaveLength(2) // Bob and Charlie active
      
      const finalActiveUsers = results[4]
      expect(finalActiveUsers.find(u => u.id === 1)).toBeUndefined() // Alice inactive
      expect(finalActiveUsers.find(u => u.id === 2)?.age).toBe(31) // Bob updated
      expect(finalActiveUsers.find(u => u.id === 3)?.active).toBe(true) // Charlie active
    })
  })
}) 