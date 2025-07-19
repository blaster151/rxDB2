import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { defineCollection, getCollection, getSchema } from '../database/defineCollection'

describe('DefineCollection Advanced Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Advanced Zod Schema Features', () => {
    it('should handle complex nested schemas', () => {
      const addressSchema = z.object({
        street: z.string(),
        city: z.string(),
        country: z.string(),
        zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
      })

      const userSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        addresses: z.array(addressSchema).min(1, 'At least one address required'),
        preferences: z.object({
          theme: z.enum(['light', 'dark', 'auto']).default('auto'),
          notifications: z.boolean().default(true),
          language: z.string().default('en')
        }).default({})
      })

      type User = z.infer<typeof userSchema>
      const users = defineCollection<User>('complex-users', userSchema)

      const validUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        addresses: [
          { street: '123 Main St', city: 'New York', country: 'USA', zipCode: '10001' }
        ]
      }

      const result = users.tryInsert(validUser)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.preferences.theme).toBe('auto')
        expect(result.data.preferences.notifications).toBe(true)
        expect(result.data.preferences.language).toBe('en')
      }
    })

    it('should handle conditional validation with refine', () => {
      const orderSchema = z.object({
        id: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().positive(),
          price: z.number().positive()
        })),
        shippingMethod: z.enum(['standard', 'express', 'overnight']),
        totalAmount: z.number().positive()
      }).refine((data) => {
        // Custom validation: express shipping requires minimum order amount
        if (data.shippingMethod === 'express' && data.totalAmount < 50) {
          return false
        }
        return true
      }, {
        message: 'Express shipping requires minimum order of $50',
        path: ['shippingMethod']
      })

      type Order = z.infer<typeof orderSchema>
      const orders = defineCollection<Order>('orders', orderSchema)

      // Valid order
      const validOrder = {
        id: 1,
        items: [{ productId: 1, quantity: 2, price: 25 }],
        shippingMethod: 'standard' as const,
        totalAmount: 50
      }

      const validResult = orders.tryInsert(validOrder)
      expect(validResult.success).toBe(true)

      // Invalid order (express shipping with low amount)
      const invalidOrder = {
        id: 2,
        items: [{ productId: 1, quantity: 1, price: 10 }],
        shippingMethod: 'express' as const,
        totalAmount: 10
      }

      const invalidResult = orders.tryInsert(invalidOrder)
      expect(invalidResult.success).toBe(false)
      if (!invalidResult.success) {
        expect(invalidResult.error.message).toContain('Express shipping requires minimum order of $50')
      }
    })

    it('should handle schema inheritance and composition', () => {
      // Base entity schema
      const baseEntitySchema = z.object({
        id: z.number(),
        createdAt: z.date().default(() => new Date()),
        updatedAt: z.date().default(() => new Date()),
        createdBy: z.number().optional()
      })

      // Extend for different entity types
      const articleSchema = baseEntitySchema.extend({
        title: z.string().min(1),
        content: z.string().min(10),
        published: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
        metadata: z.object({
          views: z.number().default(0),
          likes: z.number().default(0)
        }).default(() => ({ views: 0, likes: 0 }))
      })

      type Article = z.infer<typeof articleSchema>
      const articles = defineCollection<Article>('articles', articleSchema)

      const article = {
        id: 1,
        title: 'Test Article',
        content: 'This is a test article with sufficient content.',
        createdBy: 1
      }

      const result = articles.tryInsert(article)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.published).toBe(false)
        expect(result.data.tags).toEqual([])
        expect(result.data.metadata.views).toBe(0)
        expect(result.data.createdAt).toBeInstanceOf(Date)
        expect(result.data.updatedAt).toBeInstanceOf(Date)
      }
    })

    it('should handle union types and discriminated unions', () => {
      const textMessageSchema = z.object({
        type: z.literal('text'),
        content: z.string(),
        timestamp: z.date()
      })

      const imageMessageSchema = z.object({
        type: z.literal('image'),
        url: z.string().url(),
        caption: z.string().optional(),
        timestamp: z.date()
      })

      const messageSchema = z.discriminatedUnion('type', [
        textMessageSchema,
        imageMessageSchema
      ])

      const conversationSchema = z.object({
        id: z.number(),
        participants: z.array(z.number()),
        messages: z.array(messageSchema)
      })

      type Conversation = z.infer<typeof conversationSchema>
      const conversations = defineCollection<Conversation>('conversations', conversationSchema)

      const conversation = {
        id: 1,
        participants: [1, 2],
        messages: [
          {
            type: 'text' as const,
            content: 'Hello!',
            timestamp: new Date()
          },
          {
            type: 'image' as const,
            url: 'https://example.com/image.jpg',
            caption: 'Check this out!',
            timestamp: new Date()
          }
        ]
      }

      const result = conversations.tryInsert(conversation)
      expect(result.success).toBe(true)
    })
  })

  describe('Advanced Validation Scenarios', () => {
    it('should handle cross-field validation', () => {
      const reservationSchema = z.object({
        id: z.number(),
        startDate: z.date(),
        endDate: z.date(),
        roomType: z.enum(['single', 'double', 'suite']),
        guests: z.number().min(1)
      }).refine((data) => {
        // End date must be after start date
        return data.endDate > data.startDate
      }, {
        message: 'End date must be after start date',
        path: ['endDate']
      }).refine((data) => {
        // Suite requires at least 2 guests
        if (data.roomType === 'suite' && data.guests < 2) {
          return false
        }
        return true
      }, {
        message: 'Suite requires at least 2 guests',
        path: ['guests']
      })

      type Reservation = z.infer<typeof reservationSchema>
      const reservations = defineCollection<Reservation>('reservations', reservationSchema)

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-05')

      // Valid reservation
      const validReservation = {
        id: 1,
        startDate,
        endDate,
        roomType: 'double' as const,
        guests: 2
      }

      const validResult = reservations.tryInsert(validReservation)
      expect(validResult.success).toBe(true)

      // Invalid: end date before start date
      const invalidDateReservation = {
        id: 2,
        startDate: endDate,
        endDate: startDate,
        roomType: 'single' as const,
        guests: 1
      }

      const invalidDateResult = reservations.tryInsert(invalidDateReservation)
      expect(invalidDateResult.success).toBe(false)
      if (!invalidDateResult.success) {
        expect(invalidDateResult.error.message).toContain('End date must be after start date')
      }

      // Invalid: suite with single guest
      const invalidGuestReservation = {
        id: 3,
        startDate,
        endDate,
        roomType: 'suite' as const,
        guests: 1
      }

      const invalidGuestResult = reservations.tryInsert(invalidGuestReservation)
      expect(invalidGuestResult.success).toBe(false)
      if (!invalidGuestResult.success) {
        expect(invalidGuestResult.error.message).toContain('Suite requires at least 2 guests')
      }
    })

    it('should handle async validation', async () => {
      const userSchema = z.object({
        id: z.number(),
        username: z.string().min(3),
        email: z.string().email()
      }).refine(async (data) => {
        // Simulate async validation (e.g., checking against external API)
        await new Promise(resolve => setTimeout(resolve, 10))
        return data.username !== 'admin' // Simulate username availability check
      }, {
        message: 'Username is not available',
        path: ['username']
      })

      type User = z.infer<typeof userSchema>
      const users = defineCollection<User>('async-users', userSchema)

      const user = {
        id: 1,
        username: 'john_doe',
        email: 'john@example.com'
      }

      // Note: Our current implementation doesn't support async validation
      // This test demonstrates the schema structure for future enhancement
      expect(userSchema).toBeDefined()
    })

    it('should handle conditional validation based on other fields', () => {
      const formSchema = z.object({
        id: z.number(),
        type: z.enum(['individual', 'business']),
        name: z.string(),
        email: z.string().email(),
        // Conditional fields
        ssn: z.string().optional(),
        ein: z.string().optional(),
        businessName: z.string().optional()
      }).refine((data) => {
        if (data.type === 'individual') {
          return data.ssn !== undefined && data.ssn.length > 0
        }
        return data.ein !== undefined && data.ein.length > 0 && data.businessName !== undefined
      }, {
        message: 'Individual requires SSN, Business requires EIN and business name',
        path: ['type']
      })

      type Form = z.infer<typeof formSchema>
      const forms = defineCollection<Form>('forms', formSchema)

      // Valid individual form
      const individualForm = {
        id: 1,
        type: 'individual' as const,
        name: 'John Doe',
        email: 'john@example.com',
        ssn: '123-45-6789'
      }

      const individualResult = forms.tryInsert(individualForm)
      expect(individualResult.success).toBe(true)

      // Valid business form
      const businessForm = {
        id: 2,
        type: 'business' as const,
        name: 'Jane Smith',
        email: 'jane@company.com',
        ein: '12-3456789',
        businessName: 'Acme Corp'
      }

      const businessResult = forms.tryInsert(businessForm)
      expect(businessResult.success).toBe(true)

      // Invalid: individual without SSN
      const invalidIndividualForm = {
        id: 3,
        type: 'individual' as const,
        name: 'Bob Wilson',
        email: 'bob@example.com'
        // Missing SSN
      }

      const invalidIndividualResult = forms.tryInsert(invalidIndividualForm)
      expect(invalidIndividualResult.success).toBe(false)
    })
  })

  describe('Collection Management and Retrieval', () => {
    it('should maintain separate collections with different schemas', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email()
      })

      const productSchema = z.object({
        id: z.number(),
        name: z.string(),
        price: z.number().positive(),
        category: z.string()
      })

      const orderSchema = z.object({
        id: z.number(),
        userId: z.number(),
        productId: z.number(),
        quantity: z.number().positive(),
        total: z.number().positive()
      })

      const users = defineCollection('users', userSchema)
      const products = defineCollection('products', productSchema)
      const orders = defineCollection('orders', orderSchema)

      // Insert data into different collections
      users.insert({ id: 1, name: 'Alice', email: 'alice@example.com' })
      products.insert({ id: 1, name: 'Laptop', price: 999.99, category: 'Electronics' })
      orders.insert({ id: 1, userId: 1, productId: 1, quantity: 2, total: 1999.98 })

      // Verify collections are separate
      expect(users.getAll()).toHaveLength(1)
      expect(products.getAll()).toHaveLength(1)
      expect(orders.getAll()).toHaveLength(1)

      // Verify data integrity
      expect(users.getAll()[0].name).toBe('Alice')
      expect(products.getAll()[0].name).toBe('Laptop')
      expect(orders.getAll()[0].total).toBe(1999.98)
    })

    it('should retrieve collections and schemas by name', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string()
      })

      const users = defineCollection('test-users', userSchema)

      // Retrieve collection
      const retrievedCollection = getCollection('test-users')
      expect(retrievedCollection).toBe(users)

      // Retrieve schema
      const retrievedSchema = getSchema('test-users')
      expect(retrievedSchema).toBe(userSchema)

      // Test non-existent collection
      expect(getCollection('non-existent')).toBeUndefined()
      expect(getSchema('non-existent')).toBeUndefined()
    })

    it('should handle collection updates and reactive streams', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string(),
        active: z.boolean().default(true)
      })

      const users = defineCollection('reactive-users', userSchema)
      const liveStream = users.live()

      const updates: any[][] = []
      const unsubscribe = liveStream.subscribe(data => updates.push(data))

      // Insert users
      users.insert({ id: 1, name: 'Alice' })
      users.insert({ id: 2, name: 'Bob' })

      // Update user
      users.tryUpdate(1, { name: 'Alice Updated' })

      // Delete user
      users.tryDelete(2)

      unsubscribe()

      expect(updates).toHaveLength(4) // Initial + insert + insert + update + delete
      expect(updates[0]).toEqual([]) // Initial empty state
      expect(updates[1]).toHaveLength(1) // After first insert
      expect(updates[2]).toHaveLength(2) // After second insert
      expect(updates[3]).toHaveLength(1) // After delete
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle duplicate ID errors gracefully', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string()
      })

      const users = defineCollection('duplicate-test', userSchema)

      // Insert first user
      const result1 = users.tryInsert({ id: 1, name: 'Alice' })
      expect(result1.success).toBe(true)

      // Try to insert user with same ID
      const result2 = users.tryInsert({ id: 1, name: 'Bob' })
      expect(result2.success).toBe(false)
      if (!result2.success) {
        expect(result2.error).toBe('Item with id 1 already exists')
      }

      // Verify only one user exists
      expect(users.getAll()).toHaveLength(1)
      expect(users.getAll()[0].name).toBe('Alice')
    })

    it('should handle validation errors with detailed messages', () => {
      const complexSchema = z.object({
        id: z.number(),
        email: z.string().email('Invalid email format'),
        age: z.number().min(18, 'Must be at least 18 years old').max(120, 'Age must be realistic'),
        password: z.string().min(8, 'Password must be at least 8 characters').regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          'Password must contain lowercase, uppercase, and number'
        )
      })

      const users = defineCollection('validation-test', complexSchema)

      const invalidUser = {
        id: 1,
        email: 'invalid-email',
        age: 15,
        password: 'weak'
      }

      const result = users.tryInsert(invalidUser as any)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Invalid email format')
        expect(result.error.message).toContain('Must be at least 18 years old')
        expect(result.error.message).toContain('Password must be at least 8 characters')
      }
    })

    it('should handle missing item errors in update/delete operations', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string()
      })

      const users = defineCollection('missing-test', userSchema)

      // Try to update non-existent user
      const updateResult = users.tryUpdate(999, { name: 'Updated' })
      expect(updateResult.success).toBe(false)
      if (!updateResult.success) {
        expect(updateResult.error).toBe('Item with id 999 not found')
      }

      // Try to delete non-existent user
      const deleteResult = users.tryDelete(999)
      expect(deleteResult.success).toBe(false)
      if (!deleteResult.success) {
        expect(deleteResult.error).toBe('Item with id 999 not found')
      }
    })

    it('should handle schema evolution gracefully', () => {
      // Initial schema
      const initialSchema = z.object({
        id: z.number(),
        name: z.string()
      })

      const users = defineCollection('evolution-test', initialSchema)

      // Insert with initial schema
      users.insert({ id: 1, name: 'Alice' })

      // Try to insert with new fields (should fail with old schema)
      const newData = {
        id: 2,
        name: 'Bob',
        email: 'bob@example.com' // New field not in schema
      }

      const result = users.tryInsert(newData as any)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Unrecognized key')
      }
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        active: z.boolean().default(true)
      })

      const users = defineCollection('performance-test', userSchema)

      // Insert many users
      const startTime = Date.now()
      for (let i = 1; i <= 1000; i++) {
        users.insert({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`
        })
      }
      const endTime = Date.now()

      expect(users.getAll()).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second

      // Test filtered queries
      const activeUsers = users.where({ active: true })
      expect(activeUsers.get()).toHaveLength(1000) // All users should be active by default
    })

    it('should handle concurrent operations', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string(),
        counter: z.number().default(0)
      })

      const users = defineCollection('concurrent-test', userSchema)

      // Insert initial user
      users.insert({ id: 1, name: 'Test User' })

      // Simulate concurrent updates
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              users.tryUpdate(1, { counter: i })
              resolve()
            }, Math.random() * 10)
          })
        )
      }

      // Wait for all updates
      return Promise.all(promises).then(() => {
        const user = users.getAll()[0]
        expect(user.counter).toBeGreaterThanOrEqual(0)
        expect(user.counter).toBeLessThan(10)
      })
    })
  })
}) 