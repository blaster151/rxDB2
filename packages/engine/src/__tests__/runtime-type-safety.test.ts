import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { defineCollection } from '../database/defineCollection'

describe('Runtime Type Safety', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Schema-defined types at compile-time', () => {
    it('should enforce correct types for all fields', () => {
      const NoteSchema = z.object({
        id: z.number(),
        title: z.string().min(1, 'Title is required'),
        content: z.string().min(1, 'Content is required'),
        tags: z.array(z.string()).default([]),
        published: z.boolean().default(false),
        authorId: z.number(),
        metadata: z.object({
          views: z.number().default(0),
          likes: z.number().default(0),
          category: z.enum(['personal', 'work', 'tutorial']).default('personal')
        }).default(() => ({
          views: 0,
          likes: 0,
          category: 'personal' as const
        }))
      })

      type Note = z.infer<typeof NoteSchema>
      const notes = defineCollection<Note>('notes', NoteSchema)

      // TypeScript should catch these at compile time
      // The following would cause TypeScript errors:
      // notes.insert({ id: "string", title: 123, content: true })
      
      // Valid insert should work
      const validNote = {
        id: 1,
        title: "Test Note",
        content: "Test content",
        authorId: 1,
        tags: ["test"],
        published: true,
        metadata: {
          views: 10,
          likes: 5,
          category: "work" as const
        }
      }

      const result = notes.tryInsert(validNote)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe("Test Note")
        expect(result.data.metadata.category).toBe("work")
      }
    })

    it('should enforce required fields', () => {
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0)
      })

      type User = z.infer<typeof UserSchema>
      const users = defineCollection<User>('users', UserSchema)

      // Missing required fields should fail
      const invalidUser = {
        id: 1,
        name: "John"
        // Missing email and age
      } as any

      const result = users.tryInsert(invalidUser)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('email')
        expect(result.error.message).toContain('age')
      }
    })
  })

  describe('Runtime enforcement', () => {
    it('should validate data at runtime for insert operations', () => {
      const ProductSchema = z.object({
        id: z.number(),
        name: z.string(),
        price: z.number().positive(),
        inStock: z.boolean().default(true)
      })

      type Product = z.infer<typeof ProductSchema>
      const products = defineCollection<Product>('products', ProductSchema)

      // Test various runtime validation scenarios
      const testCases = [
        {
          name: 'Valid product',
          data: { id: 1, name: "Laptop", price: 999.99 },
          shouldSucceed: true
        },
        {
          name: 'Invalid price (negative)',
          data: { id: 2, name: "Phone", price: -100 },
          shouldSucceed: false
        },
        {
          name: 'Invalid price (string)',
          data: { id: 3, name: "Tablet", price: "expensive" as any },
          shouldSucceed: false
        },
        {
          name: 'Missing required fields',
          data: { id: 4, name: "Incomplete" } as any,
          shouldSucceed: false
        }
      ]

      testCases.forEach(testCase => {
        const result = products.tryInsert(testCase.data)
        expect(result.success).toBe(testCase.shouldSucceed)
        
        if (!testCase.shouldSucceed) {
          expect(result.error).toBeInstanceOf(Error)
        }
      })
    })

    it('should validate data at runtime for update operations', () => {
      const PostSchema = z.object({
        id: z.number(),
        title: z.string().min(1),
        content: z.string().min(10),
        published: z.boolean().default(false)
      })

      type Post = z.infer<typeof PostSchema>
      const posts = defineCollection<Post>('posts', PostSchema)

      // Insert a valid post first
      posts.insert({
        id: 1,
        title: "Original Title",
        content: "This is the original content with sufficient length",
        published: false
      })

      // Test valid update
      const validUpdate = posts.tryUpdate(1, {
        title: "Updated Title",
        published: true
      })
      expect(validUpdate.success).toBe(true)

      // Test invalid update
      const invalidUpdate = posts.tryUpdate(1, {
        title: "", // Too short
        content: "Short" // Too short
      } as any)
      expect(invalidUpdate.success).toBe(false)
      if (!invalidUpdate.success) {
        expect(invalidUpdate.error.message).toContain('title')
        expect(invalidUpdate.error.message).toContain('content')
      }
    })
  })

  describe('Type-safe reactive results', () => {
    it('should provide type-safe live queries', () => {
      const TaskSchema = z.object({
        id: z.number(),
        title: z.string(),
        completed: z.boolean().default(false),
        priority: z.enum(['low', 'medium', 'high']).default('medium'),
        dueDate: z.date().optional()
      })

      type Task = z.infer<typeof TaskSchema>
      const tasks = defineCollection<Task>('tasks', TaskSchema)

      // Insert some tasks
      tasks.insert({ id: 1, title: "Task 1", completed: false, priority: "high" })
      tasks.insert({ id: 2, title: "Task 2", completed: true, priority: "medium" })
      tasks.insert({ id: 3, title: "Task 3", completed: false, priority: "low" })

      // Type-safe live query
      const incompleteTasks = tasks.liveQuery({ completed: false })
      
      const results: Task[][] = []
      const unsubscribe = incompleteTasks.subscribe(tasks => {
        results.push(tasks)
        
        // Type-safe access to task properties
        tasks.forEach(task => {
          expect(typeof task.id).toBe('number')
          expect(typeof task.title).toBe('string')
          expect(typeof task.completed).toBe('boolean')
          expect(['low', 'medium', 'high']).toContain(task.priority)
        })
      })

      // Add another incomplete task
      tasks.insert({ id: 4, title: "Task 4", completed: false, priority: "high" })

      unsubscribe()

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].length).toBe(2) // Initial incomplete tasks
      expect(results[1].length).toBe(3) // After adding new task
    })

    it('should provide type-safe find operations', () => {
      const EventSchema = z.object({
        id: z.number(),
        name: z.string(),
        date: z.date(),
        location: z.string(),
        attendees: z.number().default(0),
        cancelled: z.boolean().default(false)
      })

      type Event = z.infer<typeof EventSchema>
      const events = defineCollection<Event>('events', EventSchema)

      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      events.insert({ id: 1, name: "Meeting", date: now, location: "Office", attendees: 5 })
      events.insert({ id: 2, name: "Party", date: tomorrow, location: "Home", attendees: 20 })
      events.insert({ id: 3, name: "Conference", date: now, location: "Convention Center", attendees: 100, cancelled: true })

      // Type-safe find operations
      const todayEvents = events.find({ date: now })
      expect(todayEvents.length).toBe(2)

      const largeEvents = events.find({ attendees: 100 })
      expect(largeEvents.length).toBe(1)
      expect(largeEvents[0].name).toBe("Conference")

      // Type-safe access to results
      todayEvents.forEach(event => {
        expect(typeof event.id).toBe('number')
        expect(typeof event.name).toBe('string')
        expect(event.date).toBeInstanceOf(Date)
        expect(typeof event.location).toBe('string')
        expect(typeof event.attendees).toBe('number')
        expect(typeof event.cancelled).toBe('boolean')
      })
    })
  })

  describe('Safe destructuring and mapping', () => {
    it('should allow safe destructuring of query results', () => {
      const BookSchema = z.object({
        id: z.number(),
        title: z.string(),
        author: z.string(),
        year: z.number(),
        genre: z.enum(['fiction', 'non-fiction', 'sci-fi', 'mystery']),
        rating: z.number().min(0).max(5).optional()
      })

      type Book = z.infer<typeof BookSchema>
      const books = defineCollection<Book>('books', BookSchema)

      books.insert({ id: 1, title: "1984", author: "George Orwell", year: 1949, genre: "fiction" })
      books.insert({ id: 2, title: "Dune", author: "Frank Herbert", year: 1965, genre: "sci-fi", rating: 4.5 })
      books.insert({ id: 3, title: "The Hobbit", author: "J.R.R. Tolkien", year: 1937, genre: "fiction", rating: 5 })

      // Safe destructuring and mapping
      const fictionBooks = books.find({ genre: "fiction" })
      
      const bookSummaries = fictionBooks.map(({ id, title, author, rating }) => ({
        id,
        title,
        author,
        hasRating: rating !== undefined,
        rating: rating || 'Not rated'
      }))

      expect(bookSummaries.length).toBe(2)
      expect(bookSummaries[0].hasRating).toBe(false)
      expect(bookSummaries[1].hasRating).toBe(true)
      expect(bookSummaries[1].rating).toBe(5)
    })

    it('should handle optional fields safely', () => {
      const ProfileSchema = z.object({
        id: z.number(),
        username: z.string(),
        email: z.string().email(),
        bio: z.string().optional(),
        avatar: z.string().url().optional(),
        preferences: z.object({
          theme: z.enum(['light', 'dark']).default('light'),
          notifications: z.boolean().default(true)
        }).optional()
      })

      type Profile = z.infer<typeof ProfileSchema>
      const profiles = defineCollection<Profile>('profiles', ProfileSchema)

      profiles.insert({ id: 1, username: "user1", email: "user1@example.com" })
      profiles.insert({ 
        id: 2, 
        username: "user2", 
        email: "user2@example.com", 
        bio: "Hello world",
        avatar: "https://example.com/avatar.jpg",
        preferences: { theme: "dark", notifications: false }
      })

      const allProfiles = profiles.getAll()
      
      // Safe handling of optional fields
      const profileInfo = allProfiles.map(profile => ({
        username: profile.username,
        hasBio: profile.bio !== undefined,
        bioLength: profile.bio?.length || 0,
        hasAvatar: profile.avatar !== undefined,
        theme: profile.preferences?.theme || 'light'
      }))

      expect(profileInfo[0].hasBio).toBe(false)
      expect(profileInfo[0].bioLength).toBe(0)
      expect(profileInfo[0].theme).toBe('light')
      
      expect(profileInfo[1].hasBio).toBe(true)
      expect(profileInfo[1].bioLength).toBe(11)
      expect(profileInfo[1].theme).toBe('dark')
    })
  })

  describe('Schema changes break type checks', () => {
    it('should demonstrate refactoring safety', () => {
      // Initial schema
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email()
      })

      type User = z.infer<typeof UserSchema>
      const users = defineCollection<User>('refactor-test', UserSchema)

      // This would work with the initial schema
      users.insert({ id: 1, name: "John", email: "john@example.com" })

      // If we change the schema to require age, TypeScript would catch this:
      // const NewUserSchema = z.object({
      //   id: z.number(),
      //   name: z.string(),
      //   email: z.string().email(),
      //   age: z.number() // New required field
      // })
      
      // This would cause a TypeScript error:
      // users.insert({ id: 2, name: "Jane", email: "jane@example.com" }) // Missing age

      // The runtime validation would also catch it
      const result = users.tryInsert({ id: 2, name: "Jane", email: "jane@example.com" } as any)
      expect(result.success).toBe(true) // Current schema allows this
    })
  })

  describe('Complex validation scenarios', () => {
    it('should handle nested object validation', () => {
      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
        country: z.string(),
        zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
      })

      const CustomerSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        addresses: z.array(AddressSchema).min(1, 'At least one address required'),
        preferences: z.object({
          newsletter: z.boolean().default(false),
          language: z.enum(['en', 'es', 'fr']).default('en')
        }).default({})
      })

      type Customer = z.infer<typeof CustomerSchema>
      const customers = defineCollection<Customer>('customers', CustomerSchema)

      // Valid customer with nested objects
      const validCustomer = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        addresses: [
          { street: "123 Main St", city: "New York", country: "USA", zipCode: "10001" }
        ]
      }

      const result = customers.tryInsert(validCustomer)
      expect(result.success).toBe(true)

      // Invalid customer with invalid nested data
      const invalidCustomer = {
        id: 2,
        name: "Jane Doe",
        email: "jane@example.com",
        addresses: [
          { street: "456 Oak St", city: "Los Angeles", country: "USA", zipCode: "invalid" }
        ]
      }

      const invalidResult = customers.tryInsert(invalidCustomer)
      expect(invalidResult.success).toBe(false)
      if (!invalidResult.success) {
        expect(invalidResult.error.message).toContain('Invalid ZIP code')
      }
    })

    it('should handle conditional validation', () => {
      const OrderSchema = z.object({
        id: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().positive(),
          price: z.number().positive()
        })),
        shippingMethod: z.enum(['standard', 'express', 'overnight']),
        totalAmount: z.number().positive()
      }).refine((data) => {
        // Express shipping requires minimum order amount
        if (data.shippingMethod === 'express' && data.totalAmount < 50) {
          return false
        }
        return true
      }, {
        message: 'Express shipping requires minimum order of $50',
        path: ['shippingMethod']
      })

      type Order = z.infer<typeof OrderSchema>
      const orders = defineCollection<Order>('orders', OrderSchema)

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
  })
}) 