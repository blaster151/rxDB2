import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { defineCollection } from '../database/defineCollection.js'
import { reactive } from '../reactive.js'
import { map, filter, scan } from '../operators.js'
import { wait, collect } from './utils.js'

describe('Collections and LiveQuery Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  describe('Zod Schema Integration', () => {
    it('should validate data with complex Zod schemas', async () => {
      // Complex nested schema
      const AddressSchema = z.object({
        street: z.string().min(1),
        city: z.string().min(1),
        zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
        country: z.enum(['US', 'CA', 'UK'])
      })

      const UserSchema = z.object({
        id: z.string().uuid(),
        name: z.string().min(2).max(50),
        email: z.string().email(),
        age: z.number().int().min(18).max(120),
        isActive: z.boolean(),
        tags: z.array(z.string()).max(10),
        address: AddressSchema.optional(),
        metadata: z.record(z.unknown()).optional(),
        createdAt: z.date(),
        updatedAt: z.date()
      })

      const Users = defineCollection('users', UserSchema)

      // Valid user data
      const validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        tags: ['developer', 'typescript'],
        address: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'US'
        },
        metadata: { lastLogin: '2024-01-01' },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Test valid insertion
      const insertResult = Users.tryInsert(validUser)
      expect(insertResult.success).toBe(true)
      expect(insertResult.data).toEqual(validUser)

      // Test invalid data
      const invalidUser = {
        id: 'invalid-uuid',
        name: 'A', // Too short
        email: 'invalid-email',
        age: 15, // Too young
        isActive: 'not-boolean',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10', 'tag11'], // Too many
        address: {
          street: '',
          city: 'NY',
          zipCode: 'invalid',
          country: 'XX' // Invalid country
        }
      }

      const invalidResult = Users.tryInsert(invalidUser as any)
      expect(invalidResult.success).toBe(false)
      expect(invalidResult.errors).toBeDefined()
      expect(invalidResult.errors?.length).toBeGreaterThan(0)
    })

    it('should handle optional and nullable fields correctly', async () => {
      const ProductSchema = z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        price: z.number().positive(),
        category: z.string().nullable(),
        tags: z.array(z.string()).optional().default([]),
        isAvailable: z.boolean().default(true)
      })

      const Products = defineCollection('products', ProductSchema)

      // Minimal valid product
      const minimalProduct = {
        id: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        category: null
      }

      const result1 = Products.tryInsert(minimalProduct)
      expect(result1.success).toBe(true)
      expect(result1.data?.tags).toEqual([])
      expect(result1.data?.isAvailable).toBe(true)

      // Full product
      const fullProduct = {
        id: 'prod-2',
        name: 'Full Product',
        description: 'A complete product description',
        price: 49.99,
        category: 'electronics',
        tags: ['new', 'featured'],
        isAvailable: false
      }

      const result2 = Products.tryInsert(fullProduct)
      expect(result2.success).toBe(true)
      expect(result2.data).toEqual(fullProduct)
    })

    it('should handle union types and discriminated unions', async () => {
      const BaseEventSchema = z.object({
        id: z.string(),
        timestamp: z.date(),
        userId: z.string()
      })

      const UserLoginEventSchema = BaseEventSchema.extend({
        type: z.literal('login'),
        ipAddress: z.string().ip(),
        userAgent: z.string()
      })

      const UserLogoutEventSchema = BaseEventSchema.extend({
        type: z.literal('logout'),
        sessionDuration: z.number().positive()
      })

      const UserEventSchema = z.discriminatedUnion('type', [
        UserLoginEventSchema,
        UserLogoutEventSchema
      ])

      const Events = defineCollection('events', UserEventSchema)

      // Login event
      const loginEvent = {
        id: 'event-1',
        timestamp: new Date(),
        userId: 'user-1',
        type: 'login' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      }

      const loginResult = Events.tryInsert(loginEvent)
      expect(loginResult.success).toBe(true)

      // Logout event
      const logoutEvent = {
        id: 'event-2',
        timestamp: new Date(),
        userId: 'user-1',
        type: 'logout' as const,
        sessionDuration: 3600
      }

      const logoutResult = Events.tryInsert(logoutEvent)
      expect(logoutResult.success).toBe(true)
    })
  })

  describe('LiveQuery Integration', () => {
    it('should provide reactive queries that update automatically', async () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
        age: z.number(),
        isActive: z.boolean()
      })

      const Users = defineCollection('users', UserSchema)

      // Insert initial data
      Users.insert({ id: '1', name: 'Alice', age: 25, isActive: true })
      Users.insert({ id: '2', name: 'Bob', age: 30, isActive: true })
      Users.insert({ id: '3', name: 'Charlie', age: 35, isActive: false })

      // Create live query for active users
      const activeUsers = Users.find({ isActive: true })
      
      // Initial state
      let values = await collect(activeUsers)
      expect(values).toHaveLength(2)
      expect(values.map(u => u.name)).toEqual(['Alice', 'Bob'])

      // Add new active user
      Users.insert({ id: '4', name: 'Diana', age: 28, isActive: true })
      
      // Query should update automatically
      values = await collect(activeUsers)
      expect(values).toHaveLength(3)
      expect(values.map(u => u.name)).toEqual(['Alice', 'Bob', 'Diana'])

      // Deactivate a user
      Users.update('1', { isActive: false })
      
      // Query should update again
      values = await collect(activeUsers)
      expect(values).toHaveLength(2)
      expect(values.map(u => u.name)).toEqual(['Bob', 'Diana'])
    })

    it('should handle complex queries with multiple conditions', async () => {
      const ProductSchema = z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
        category: z.string(),
        inStock: z.boolean(),
        rating: z.number().min(1).max(5)
      })

      const Products = defineCollection('products', ProductSchema)

      // Insert test data
      Products.insert({ id: '1', name: 'Laptop', price: 999, category: 'electronics', inStock: true, rating: 4.5 })
      Products.insert({ id: '2', name: 'Mouse', price: 25, category: 'electronics', inStock: true, rating: 4.0 })
      Products.insert({ id: '3', name: 'Book', price: 15, category: 'books', inStock: false, rating: 4.8 })
      Products.insert({ id: '4', name: 'Tablet', price: 299, category: 'electronics', inStock: true, rating: 3.5 })

      // Complex query: electronics in stock with rating >= 4.0
      const highRatedElectronics = Products.find({
        category: 'electronics',
        inStock: true,
        rating: { $gte: 4.0 }
      })

      let values = await collect(highRatedElectronics)
      expect(values).toHaveLength(2)
      expect(values.map(p => p.name)).toEqual(['Laptop', 'Mouse'])

      // Update rating
      Products.update('4', { rating: 4.2 })
      
      // Query should include the updated product
      values = await collect(highRatedElectronics)
      expect(values).toHaveLength(3)
      expect(values.map(p => p.name)).toEqual(['Laptop', 'Mouse', 'Tablet'])
    })

    it('should support reactive transformations on query results', async () => {
      const OrderSchema = z.object({
        id: z.string(),
        customerId: z.string(),
        amount: z.number(),
        status: z.enum(['pending', 'processing', 'shipped', 'delivered']),
        createdAt: z.date()
      })

      const Orders = defineCollection('orders', OrderSchema)

      // Insert orders
      Orders.insert({ id: '1', customerId: 'cust-1', amount: 100, status: 'pending', createdAt: new Date() })
      Orders.insert({ id: '2', customerId: 'cust-1', amount: 200, status: 'shipped', createdAt: new Date() })
      Orders.insert({ id: '3', customerId: 'cust-2', amount: 150, status: 'delivered', createdAt: new Date() })

      // Live query with reactive transformations
      const customerOrders = Orders.find({ customerId: 'cust-1' })
      
      // Transform to get total amount
      const totalAmount = customerOrders.pipe(
        map((orders) => orders.reduce((sum, order) => sum + order.amount, 0))
      )

      // Transform to get status counts
      const statusCounts = customerOrders.pipe(
        map((orders) => {
          const counts = { pending: 0, processing: 0, shipped: 0, delivered: 0 }
          orders.forEach(order => counts[order.status]++)
          return counts
        })
      )

      // Test initial values
      let total = await collect(totalAmount)
      expect(total).toBe(300)

      let counts = await collect(statusCounts)
      expect(counts).toEqual({ pending: 1, processing: 0, shipped: 1, delivered: 0 })

      // Add new order
      Orders.insert({ id: '4', customerId: 'cust-1', amount: 75, status: 'processing', createdAt: new Date() })

      // Transformations should update automatically
      total = await collect(totalAmount)
      expect(total).toBe(375)

      counts = await collect(statusCounts)
      expect(counts).toEqual({ pending: 1, processing: 1, shipped: 1, delivered: 0 })
    })

    it('should handle pagination and sorting reactively', async () => {
      const ArticleSchema = z.object({
        id: z.string(),
        title: z.string(),
        author: z.string(),
        views: z.number(),
        publishedAt: z.date()
      })

      const Articles = defineCollection('articles', ArticleSchema)

      // Insert articles
      const now = new Date()
      Articles.insert({ id: '1', title: 'First Article', author: 'Alice', views: 100, publishedAt: new Date(now.getTime() - 86400000) })
      Articles.insert({ id: '2', title: 'Second Article', author: 'Bob', views: 250, publishedAt: new Date(now.getTime() - 43200000) })
      Articles.insert({ id: '3', title: 'Third Article', author: 'Alice', views: 75, publishedAt: now })

      // Live query with sorting and pagination
      const allArticles = Articles.find({})
      
      // Sort by views descending
      const topArticles = allArticles.pipe(
        map((articles) => articles.sort((a, b) => b.views - a.views))
      )

      // Get top 2 articles
      const top2Articles = topArticles.pipe(
        map((articles) => articles.slice(0, 2))
      )

      // Get articles by author
      const aliceArticles = allArticles.pipe(
        map((articles) => articles.filter(article => article.author === 'Alice'))
      )

      // Test initial state
      let top2 = await collect(top2Articles)
      expect(top2.map(a => a.title)).toEqual(['Second Article', 'First Article'])

      let aliceCount = await collect(aliceArticles.pipe(map(articles => articles.length)))
      expect(aliceCount).toBe(2)

      // Add new article with high views
      Articles.insert({ id: '4', title: 'Viral Article', author: 'Charlie', views: 1000, publishedAt: now })

      // Queries should update automatically
      top2 = await collect(top2Articles)
      expect(top2.map(a => a.title)).toEqual(['Viral Article', 'Second Article'])

      aliceCount = await collect(aliceArticles.pipe(map(articles => articles.length)))
      expect(aliceCount).toBe(2) // Still 2 Alice articles
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle e-commerce inventory management', async () => {
      const ProductSchema = z.object({
        id: z.string(),
        name: z.string(),
        price: z.number().positive(),
        stock: z.number().int().min(0),
        category: z.string(),
        isActive: z.boolean()
      })

      const OrderSchema = z.object({
        id: z.string(),
        productId: z.string(),
        quantity: z.number().int().positive(),
        status: z.enum(['pending', 'confirmed', 'shipped', 'cancelled']),
        createdAt: z.date()
      })

      const Products = defineCollection('products', ProductSchema)
      const Orders = defineCollection('orders', OrderSchema)

      // Insert products
      Products.insert({ id: 'prod-1', name: 'Laptop', price: 999, stock: 10, category: 'electronics', isActive: true })
      Products.insert({ id: 'prod-2', name: 'Mouse', price: 25, stock: 50, category: 'electronics', isActive: true })
      Products.insert({ id: 'prod-3', name: 'Book', price: 15, stock: 0, category: 'books', isActive: true })

      // Live query for low stock products
      const lowStockProducts = Products.find({ stock: { $lt: 5 } })
      
      // Live query for out of stock products
      const outOfStockProducts = Products.find({ stock: 0 })

      // Test initial state
      let lowStock = await collect(lowStockProducts)
      expect(lowStock).toHaveLength(1) // Laptop with stock 10
      expect(lowStock[0].name).toBe('Laptop')

      let outOfStock = await collect(outOfStockProducts)
      expect(outOfStock).toHaveLength(1) // Book
      expect(outOfStock[0].name).toBe('Book')

      // Process orders
      Orders.insert({ id: 'order-1', productId: 'prod-1', quantity: 8, status: 'confirmed', createdAt: new Date() })
      Orders.insert({ id: 'order-2', productId: 'prod-2', quantity: 45, status: 'confirmed', createdAt: new Date() })

      // Update stock based on orders
      const confirmedOrders = Orders.find({ status: 'confirmed' })
      confirmedOrders.subscribe(async (orders) => {
        for (const order of orders) {
          const product = Products.findOne({ id: order.productId })
          if (product) {
            const newStock = Math.max(0, product.stock - order.quantity)
            Products.update(order.productId, { stock: newStock })
          }
        }
      })

      // Wait for updates
      await wait(10)

      // Check updated stock levels
      lowStock = await collect(lowStockProducts)
      expect(lowStock).toHaveLength(2) // Laptop (2) and Mouse (5)

      outOfStock = await collect(outOfStockProducts)
      expect(outOfStock).toHaveLength(1) // Still just Book
    })

    it('should handle real-time chat application', async () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
        isOnline: z.boolean(),
        lastSeen: z.date()
      })

      const MessageSchema = z.object({
        id: z.string(),
        senderId: z.string(),
        content: z.string(),
        timestamp: z.date(),
        isRead: z.boolean()
      })

      const Users = defineCollection('users', UserSchema)
      const Messages = defineCollection('messages', MessageSchema)

      // Insert users
      Users.insert({ id: 'user-1', name: 'Alice', isOnline: true, lastSeen: new Date() })
      Users.insert({ id: 'user-2', name: 'Bob', isOnline: false, lastSeen: new Date() })

      // Live query for online users
      const onlineUsers = Users.find({ isOnline: true })
      
      // Live query for unread messages
      const unreadMessages = Messages.find({ isRead: false })
      
      // Live query for recent messages (last 10)
      const allMessages = Messages.find({})
      const recentMessages = allMessages.pipe(
        map((messages) => messages
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 10)
        )
      )

      // Test initial state
      let online = await collect(onlineUsers)
      expect(online).toHaveLength(1)
      expect(online[0].name).toBe('Alice')

      let unread = await collect(unreadMessages)
      expect(unread).toHaveLength(0)

      // Send messages
      Messages.insert({ id: 'msg-1', senderId: 'user-1', content: 'Hello Bob!', timestamp: new Date(), isRead: false })
      Messages.insert({ id: 'msg-2', senderId: 'user-2', content: 'Hi Alice!', timestamp: new Date(), isRead: false })

      // Check updates
      unread = await collect(unreadMessages)
      expect(unread).toHaveLength(2)

      let recent = await collect(recentMessages)
      expect(recent).toHaveLength(2)

      // Mark message as read
      Messages.update('msg-1', { isRead: true })

      // Check updates
      unread = await collect(unreadMessages)
      expect(unread).toHaveLength(1)
      expect(unread[0].content).toBe('Hi Alice!')

      // User goes offline
      Users.update('user-1', { isOnline: false, lastSeen: new Date() })

      // Check updates
      online = await collect(onlineUsers)
      expect(online).toHaveLength(0)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle schema validation errors gracefully', async () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string().min(2),
        email: z.string().email()
      })

      const Users = defineCollection('users', UserSchema)

      // Test invalid data
      const invalidResult = Users.tryInsert({
        id: '1',
        name: 'A', // Too short
        email: 'invalid-email'
      })

      expect(invalidResult.success).toBe(false)
      expect(invalidResult.errors).toBeDefined()
      expect(invalidResult.errors?.length).toBeGreaterThan(0)

      // Test partial updates with invalid data
      Users.insert({ id: '2', name: 'Valid User', email: 'valid@example.com' })
      
      const updateResult = Users.tryUpdate('2', { name: 'A' })
      expect(updateResult.success).toBe(false)
    })

    it('should handle empty query results', async () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string()
      })

      const Users = defineCollection('users', UserSchema)

      // Query empty collection
      const emptyQuery = Users.find({ name: 'NonExistent' })
      const values = await collect(emptyQuery)
      expect(values).toEqual([])

      // Query with complex conditions
      const complexQuery = Users.find({
        name: { $regex: /^A/ },
        id: { $in: ['1', '2', '3'] }
      })
      const complexValues = await collect(complexQuery)
      expect(complexValues).toEqual([])
    })

    it('should handle concurrent updates correctly', async () => {
      const CounterSchema = z.object({
        id: z.string(),
        value: z.number()
      })

      const Counters = defineCollection('counters', CounterSchema)
      Counters.insert({ id: 'counter-1', value: 0 })

      // Multiple concurrent updates
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          Counters.update('counter-1', { value: i + 1 })
        )
      }

      await Promise.all(promises)

      // Final value should be the last update
      const finalCounter = Counters.findOne({ id: 'counter-1' })
      expect(finalCounter?.value).toBe(10)
    })
  })
}) 