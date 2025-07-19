import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { defineCollection } from '../database/defineCollection'
import { collect } from './utils'

describe('Duplicate ID and Non-Existent Update Behaviors', () => {
  const userSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(0),
    active: z.boolean().default(true),
    role: z.enum(['admin', 'user', 'guest']).default('user'),
    tags: z.array(z.string()).default([])
  })

  type User = z.infer<typeof userSchema>

  describe('🔁 Inserting with Duplicate ID (Option A - Recommended)', () => {
    it('should throw error on duplicate ID with insert()', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert first user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Try to insert user with same ID - should throw
      expect(() => {
        users.insert({
          id: 1, // Duplicate ID
          name: 'Alice Updated',
          email: 'alice.updated@example.com',
          age: 26
        })
      }).toThrow('Item with id 1 already exists')
      
      // Original data should be unchanged
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(1)
      expect(allUsers[0].name).toBe('Alice')
      expect(allUsers[0].email).toBe('alice@example.com')
      expect(allUsers[0].age).toBe(25)
    })

    it('should return error on duplicate ID with tryInsert()', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert first user
      const result1 = users.tryInsert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      expect(result1.success).toBe(true)
      
      // Try to insert user with same ID - should return error
      const result2 = users.tryInsert({
        id: 1, // Duplicate ID
        name: 'Alice Updated',
        email: 'alice.updated@example.com',
        age: 26
      })
      
      expect(result2.success).toBe(false)
      if (!result2.success) {
        expect(result2.error).toBe('Item with id 1 already exists')
      }
      
      // Original data should be unchanged
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(1)
      expect(allUsers[0].name).toBe('Alice')
      expect(allUsers[0].email).toBe('alice@example.com')
      expect(allUsers[0].age).toBe(25)
    })

    it('should return error on duplicate ID with validateInsert()', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert first user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Validate insert with duplicate ID - should return error
      const result = users.validateInsert({
        id: 1, // Duplicate ID
        name: 'Alice Updated',
        email: 'alice.updated@example.com',
        age: 26
      })
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Item with id 1 already exists')
      }
      
      // Data should be unchanged (validation only)
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(1)
      expect(allUsers[0].name).toBe('Alice')
    })

    it('should NOT trigger liveQuery on failed duplicate insert', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to live query
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Insert first user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Try to insert duplicate - should fail and NOT trigger liveQuery
      try {
        users.insert({
          id: 1, // Duplicate ID
          name: 'Alice Updated',
          email: 'alice.updated@example.com',
          age: 26
        })
      } catch (error) {
        // Expected to throw
      }
      
      unsubscribe()
      
      // Should only have 2 emissions: initial empty + successful insert
      expect(results).toHaveLength(2)
      expect(results[1]).toHaveLength(1)
      expect(results[1][0].name).toBe('Alice') // Original data unchanged
      expect(results[1][0].email).toBe('alice@example.com')
      expect(results[1][0].age).toBe(25)
    })

    it('should NOT trigger filtered query on failed duplicate insert', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to admin users
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
      
      // Try to insert duplicate admin - should fail and NOT trigger query
      try {
        users.insert({
          id: 1, // Duplicate ID
          name: 'Alice Updated',
          email: 'alice.updated@example.com',
          age: 26,
          role: 'admin'
        })
      } catch (error) {
        // Expected to throw
      }
      
      unsubscribe()
      
      // Should only have 2 emissions: initial empty + successful insert
      expect(results).toHaveLength(2)
      expect(results[1]).toHaveLength(1)
      expect(results[1][0].name).toBe('Alice') // Original data unchanged
    })

    it('should handle multiple duplicate attempts', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert first user
      users.insert({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        age: 25
      })
      
      // Multiple duplicate attempts
      for (let i = 0; i < 3; i++) {
        const result = users.tryInsert({
          id: 1, // Duplicate ID
          name: `Alice${i}`,
          email: `alice${i}@example.com`,
          age: 25 + i
        })
        
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBe('Item with id 1 already exists')
        }
      }
      
      // Data should still be unchanged
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(1)
      expect(allUsers[0].name).toBe('Alice')
      expect(allUsers[0].email).toBe('alice@example.com')
    })
  })

  describe('✏️ Updating Non-Existent Note (Option A - Recommended)', () => {
    it('should throw error on update of non-existent item', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Try to update non-existent user - should throw
      expect(() => {
        users.update(999, { name: 'Non-existent' })
      }).toThrow('Item with id 999 not found')
      
      // Collection should remain empty
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(0)
    })

    it('should return error on update of non-existent item with tryUpdate()', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Try to update non-existent user - should return error
      const result = users.tryUpdate(999, { name: 'Non-existent' })
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Item with id 999 not found')
      }
      
      // Collection should remain empty
      const allUsers = users.getAll()
      expect(allUsers).toHaveLength(0)
    })

    it('should NOT trigger liveQuery on failed non-existent update', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to live query
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Try to update non-existent user - should fail and NOT trigger liveQuery
      try {
        users.update(999, { name: 'Non-existent' })
      } catch (error) {
        // Expected to throw
      }
      
      unsubscribe()
      
      // Should only have 1 emission: initial empty
      expect(results).toHaveLength(1)
      expect(results[0]).toHaveLength(0)
    })

    it('should NOT trigger filtered query on failed non-existent update', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to admin users
      const adminUsers = users.where({ role: 'admin' })
      const results: User[][] = []
      const unsubscribe = adminUsers.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Try to update non-existent user to admin - should fail and NOT trigger query
      try {
        users.update(999, { role: 'admin' })
      } catch (error) {
        // Expected to throw
      }
      
      unsubscribe()
      
      // Should only have 1 emission: initial empty
      expect(results).toHaveLength(1)
      expect(results[0]).toHaveLength(0)
    })

    it('should handle update after delete correctly', async () => {
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
        age: 25
      })
      
      // Delete user
      users.delete(1)
      
      // Try to update deleted user - should fail and NOT trigger liveQuery
      try {
        users.update(1, { name: 'Alice Updated' })
      } catch (error) {
        // Expected to throw
      }
      
      unsubscribe()
      
      // Should have 3 emissions: initial empty + insert + delete
      expect(results).toHaveLength(3)
      expect(results[1]).toHaveLength(1) // Alice inserted
      expect(results[2]).toHaveLength(0) // Alice deleted
      // No additional emission for failed update
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complex scenario with duplicates and non-existent updates', async () => {
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
      
      // Try duplicate insert - should fail
      try {
        users.insert({
          id: 1,
          name: 'Alice Duplicate',
          email: 'alice.duplicate@example.com',
          age: 26
        })
      } catch (error) {
        // Expected to throw
      }
      
      // Update existing user - should succeed
      users.update(1, { role: 'admin' })
      
      // Try update non-existent user - should fail
      try {
        users.update(999, { name: 'Non-existent' })
      } catch (error) {
        // Expected to throw
      }
      
      // Insert another user
      users.insert({
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        age: 30,
        role: 'user'
      })
      
      unsubscribe()
      
      // Should have 4 emissions: initial empty + insert + update + insert2
      expect(results).toHaveLength(4)
      expect(results[1]).toHaveLength(1) // Alice inserted
      expect(results[2]).toHaveLength(1) // Alice updated to admin
      expect(results[3]).toHaveLength(2) // Bob added
      
      // Verify final state
      const finalUsers = results[3]
      expect(finalUsers.find(u => u.id === 1)?.role).toBe('admin')
      expect(finalUsers.find(u => u.id === 2)?.role).toBe('user')
    })

    it('should handle rapid operations with failures', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to live query
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe((users: User[]) => {
        results.push(users)
      })
      
      // Rapid operations with some failures
      for (let i = 1; i <= 5; i++) {
        // Insert user
        users.insert({
          id: i,
          name: `User${i}`,
          email: `user${i}@example.com`,
          age: 20 + i
        })
        
        // Try duplicate insert - should fail
        try {
          users.insert({
            id: i,
            name: `User${i}Duplicate`,
            email: `user${i}.duplicate@example.com`,
            age: 30 + i
          })
        } catch (error) {
          // Expected to throw
        }
        
        // Try update non-existent user - should fail
        try {
          users.update(999 + i, { name: 'Non-existent' })
        } catch (error) {
          // Expected to throw
        }
      }
      
      unsubscribe()
      
      // Should have 6 emissions: initial empty + 5 successful inserts
      expect(results).toHaveLength(6)
      expect(results[results.length - 1]).toHaveLength(5) // 5 users total
      
      // Verify all users are present
      const finalUsers = results[results.length - 1]
      for (let i = 1; i <= 5; i++) {
        const user = finalUsers.find(u => u.id === i)
        expect(user).toBeDefined()
        expect(user?.name).toBe(`User${i}`)
        expect(user?.email).toBe(`user${i}@example.com`)
      }
    })
  })

  describe('Error Message Consistency', () => {
    it('should provide consistent error messages', () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Test duplicate ID error message
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 })
      
      const duplicateResult = users.tryInsert({ id: 1, name: 'Alice2', email: 'alice2@example.com', age: 26 })
      expect(duplicateResult.success).toBe(false)
      if (!duplicateResult.success) {
        expect(duplicateResult.error).toBe('Item with id 1 already exists')
      }
      
      // Test non-existent update error message
      const updateResult = users.tryUpdate(999, { name: 'Non-existent' })
      expect(updateResult.success).toBe(false)
      if (!updateResult.success) {
        expect(updateResult.error).toBe('Item with id 999 not found')
      }
      
      // Test non-existent delete error message
      const deleteResult = users.tryDelete(999)
      expect(deleteResult.success).toBe(false)
      if (!deleteResult.success) {
        expect(deleteResult.error).toBe('Item with id 999 not found')
      }
    })
  })
}) 