import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { defineCollection } from '../database/defineCollection'
import { collect } from './utils'

describe('LiveQuery', () => {
  const userSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(0),
    active: z.boolean().default(true),
    role: z.enum(['admin', 'user', 'guest']).default('user')
  })

  type User = z.infer<typeof userSchema>

  describe('Emits on initial subscription', () => {
    it('should emit current data when subscribed', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert data before subscription
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 })
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30 })
      
      // Subscribe to live query
      const liveQuery = users.live()
      const result = await collect(liveQuery)
      
      expect(result).toEqual([
        [
          { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' },
          { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true, role: 'user' }
        ]
      ])
    })

    it('should emit empty array for empty collection', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const result = await collect(liveQuery)
      
      expect(result).toEqual([[]])
    })
  })

  describe('Emits only on relevant changes', () => {
    it('should emit only when queried data changes', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to active users only
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe(val => results.push(val))
      
      // Insert active user - should emit
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
      
      // Insert inactive user - should NOT emit for active users query
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: false })
      
      // Insert another active user - should emit
      users.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }],
        [
          { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' },
          { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true, role: 'user' }
        ]
      ])
    })

    it('should not emit on irrelevant field updates', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to users with specific role
      const adminUsers = users.where({ role: 'admin' })
      const results: User[][] = []
      const unsubscribe = adminUsers.subscribe(val => results.push(val))
      
      // Insert admin user
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, role: 'admin' })
      
      // Update non-queried field (age) - should NOT emit
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 26, role: 'admin' })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'admin' }]
        // Note: No emission for age update since we're querying by role
      ])
    })
  })

  describe('Emits on update', () => {
    it('should emit when existing item is updated to match query', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert inactive user
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: false })
      
      // Subscribe to active users
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe(val => results.push(val))
      
      // Update user to active - should emit
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }]
      ])
    })

    it('should emit when existing item is updated to no longer match query', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Insert active user
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
      
      // Subscribe to active users
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe(val => results.push(val))
      
      // Update user to inactive - should emit (remove from results)
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: false })
      
      unsubscribe()
      
      expect(results).toEqual([
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }],
        [] // empty after user becomes inactive
      ])
    })
  })

  describe('Does not emit on irrelevant changes', () => {
    it('should not emit when non-queried fields change', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to users by name
      const aliceUsers = users.where({ name: 'Alice' })
      const results: User[][] = []
      const unsubscribe = aliceUsers.subscribe(val => results.push(val))
      
      // Insert Alice
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 })
      
      // Update Alice's age - should NOT emit since we're not querying by age
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 26 })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }]
        // No emission for age update
      ])
    })

    it('should not emit when item no longer matches query criteria', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to users with age > 30
      const olderUsers = users.where({ age: 35 }) // This will match users with age 35
      const results: User[][] = []
      const unsubscribe = olderUsers.subscribe(val => results.push(val))
      
      // Insert user with age 25 - should not match
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 })
      
      // Insert user with age 35 - should match
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 35 })
      
      // Update Bob's age to 40 - should not emit since we're querying for age 35 specifically
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 40 })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 2, name: 'Bob', email: 'bob@example.com', age: 35, active: true, role: 'user' }]
        // No emission for age 40 update
      ])
    })
  })

  describe('Emits on create', () => {
    it('should emit when new item matches query criteria', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to admin users
      const adminUsers = users.where({ role: 'admin' })
      const results: User[][] = []
      const unsubscribe = adminUsers.subscribe(val => results.push(val))
      
      // Insert regular user - should not emit
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, role: 'user' })
      
      // Insert admin user - should emit
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, role: 'admin' })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true, role: 'admin' }]
      ])
    })

    it('should emit multiple times for multiple matching inserts', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to active users
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe(val => results.push(val))
      
      // Insert multiple active users
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true })
      users.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }],
        [
          { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' },
          { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true, role: 'user' }
        ],
        [
          { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' },
          { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true, role: 'user' },
          { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true, role: 'user' }
        ]
      ])
    })
  })

  describe('Unsubscription', () => {
    it('should ensure no emissions after unsubscribe', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe(val => results.push(val))
      
      // Insert data while subscribed
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 })
      
      // Unsubscribe
      unsubscribe()
      
      // Insert more data after unsubscribe
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30 })
      users.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35 })
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }]
      ])
      // Should not include Bob or Charlie
    })

    it('should handle multiple unsubscribes safely', () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe(val => results.push(val))
      
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25 })
      
      // Multiple unsubscribes should not throw
      unsubscribe()
      unsubscribe()
      unsubscribe()
      
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30 })
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }]
      ])
    })

    it('should cleanup filtered query subscriptions', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const activeUsers = users.where({ active: true })
      const results: User[][] = []
      const unsubscribe = activeUsers.subscribe(val => results.push(val))
      
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
      
      unsubscribe()
      
      // Insert more data after unsubscribe
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true })
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }]
      ])
      // Should not include Bob
    })
  })

  describe('Handles edge cases', () => {
    it('should handle rapid changes gracefully', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const liveQuery = users.live()
      const results: User[][] = []
      const unsubscribe = liveQuery.subscribe(val => results.push(val))
      
      // Rapid insertions
      for (let i = 1; i <= 10; i++) {
        users.insert({ 
          id: i, 
          name: `User${i}`, 
          email: `user${i}@example.com`, 
          age: 20 + i 
        })
      }
      
      unsubscribe()
      
      expect(results).toHaveLength(11) // initial + 10 updates
      expect(results[results.length - 1]).toHaveLength(10) // final result has all users
    })

    it('should handle multiple subscribers to same query', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      const activeUsers = users.where({ active: true })
      const results1: User[][] = []
      const results2: User[][] = []
      
      const unsubscribe1 = activeUsers.subscribe(val => results1.push(val))
      const unsubscribe2 = activeUsers.subscribe(val => results2.push(val))
      
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: false })
      users.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true })
      
      unsubscribe1()
      unsubscribe2()
      
      // Both subscribers should get the same results
      expect(results1).toEqual(results2)
      expect(results1).toEqual([
        [], // initial empty state
        [{ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }],
        [
          { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' },
          { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true, role: 'user' }
        ]
      ])
    })

    it('should handle complex filtering criteria', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to active admin users over 30
      const activeAdminOlder = users.where({ active: true, role: 'admin' })
      const results: User[][] = []
      const unsubscribe = activeAdminOlder.subscribe(val => results.push(val))
      
      // Insert various users
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true, role: 'user' }) // no match
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 35, active: true, role: 'admin' }) // match
      users.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 40, active: false, role: 'admin' }) // no match
      users.insert({ id: 4, name: 'David', email: 'david@example.com', age: 45, active: true, role: 'admin' }) // match
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        [{ id: 2, name: 'Bob', email: 'bob@example.com', age: 35, active: true, role: 'admin' }],
        [
          { id: 2, name: 'Bob', email: 'bob@example.com', age: 35, active: true, role: 'admin' },
          { id: 4, name: 'David', email: 'david@example.com', age: 45, active: true, role: 'admin' }
        ]
      ])
    })

    it('should handle empty results correctly', async () => {
      const users = defineCollection<User>('users', userSchema)
      
      // Subscribe to non-existent role
      const guestUsers = users.where({ role: 'guest' })
      const results: User[][] = []
      const unsubscribe = guestUsers.subscribe(val => results.push(val))
      
      // Insert users with other roles
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, role: 'user' })
      users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, role: 'admin' })
      
      unsubscribe()
      
      expect(results).toEqual([
        [], // initial empty state
        // No additional emissions since no users match the criteria
      ])
    })
  })
}) 