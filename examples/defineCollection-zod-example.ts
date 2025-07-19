import { z } from 'zod'
import { defineCollection, getCollection, getSchema } from '../packages/engine/src/database/defineCollection'

console.log('=== DefineCollection with Zod Validation Examples ===')

// Example 1: Basic User Collection
console.log('\n--- Basic User Collection ---')

const userSchema = z.object({
  id: z.number(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format').optional(),
  age: z.number().min(0, 'Age must be positive').max(150, 'Age must be realistic'),
  active: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  tags: z.array(z.string()).default([])
})

type User = z.infer<typeof userSchema>

const users = defineCollection<User>('users', userSchema)

// Valid insertions
console.log('Inserting valid users...')
users.insert({
  id: 1,
  name: 'Alice Johnson',
  email: 'alice@example.com',
  age: 28
})

users.insert({
  id: 2,
  name: 'Bob Smith',
  age: 35,
  tags: ['developer', 'admin']
})

console.log('All users:', users.getAll())

// Invalid insertion (will throw)
console.log('\nTrying invalid insertion...')
try {
  users.insert({
    id: 3,
    name: 'A', // Too short
    email: 'invalid-email',
    age: -5
  } as any)
} catch (error) {
  console.log('Validation error caught:', error.message)
}

// Safe insertion with tryInsert
console.log('\nTrying safe insertion...')
const result = users.tryInsert({
  id: 4,
  name: 'Charlie Brown',
  email: 'charlie@example.com',
  age: 25
})

if (result.success) {
  console.log('Successfully inserted:', result.data)
} else {
  console.log('Insert failed:', result.error)
}

// Example 2: Complex Schema with Relationships
console.log('\n--- Complex Schema with Relationships ---')

const postSchema = z.object({
  id: z.number(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  authorId: z.number(),
  published: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  metadata: z.object({
    views: z.number().default(0),
    likes: z.number().default(0),
    createdAt: z.date().default(() => new Date())
  }).default(() => ({
    views: 0,
    likes: 0,
    createdAt: new Date()
  }))
})

type Post = z.infer<typeof postSchema>

const posts = defineCollection<Post>('posts', postSchema)

// Insert posts
posts.insert({
  id: 1,
  title: 'Getting Started with RxDB',
  content: 'This is a comprehensive guide to getting started with reactive databases...',
  authorId: 1,
  published: true,
  tags: ['tutorial', 'database'],
  metadata: {
    views: 150,
    likes: 25
  }
})

posts.insert({
  id: 2,
  title: 'Advanced Reactive Patterns',
  content: 'Learn about advanced patterns for building reactive applications...',
  authorId: 2,
  tags: ['advanced', 'patterns']
})

console.log('All posts:', posts.getAll())

// Example 3: Validation without Insertion
console.log('\n--- Validation without Insertion ---')

const validationResult = users.validateInsert({
  id: 5,
  name: 'Diana Prince',
  email: 'diana@example.com',
  age: 30
})

if (validationResult.success) {
  console.log('Validation passed:', validationResult.data)
  console.log('But data was not inserted (validateInsert only validates)')
  console.log('Current user count:', users.getAll().length)
} else {
  console.log('Validation failed:', validationResult.error)
}

// Example 4: Update Operations
console.log('\n--- Update Operations ---')

// Successful update
const updateResult = users.tryUpdate(1, {
  age: 29,
  tags: ['developer', 'designer']
})

if (updateResult.success) {
  console.log('Update successful:', updateResult.data)
} else {
  console.log('Update failed:', updateResult.error)
}

// Update with validation error
const invalidUpdate = users.tryUpdate(2, {
  age: -10 // Invalid age
} as any)

if (!invalidUpdate.success) {
  console.log('Update validation failed:', invalidUpdate.error)
}

// Example 5: Delete Operations
console.log('\n--- Delete Operations ---')

const deleteResult = users.tryDelete(2)
if (deleteResult.success) {
  console.log('Deleted user:', deleteResult.data)
} else {
  console.log('Delete failed:', deleteResult.error)
}

console.log('Remaining users:', users.getAll())

// Example 6: Reactive Streams
console.log('\n--- Reactive Streams ---')

const liveUsers = users.live()
const unsubscribe = liveUsers.subscribe((userList) => {
  console.log('Live users update:', userList.length, 'users')
})

// Add a new user to see reactive updates
users.insert({
  id: 6,
  name: 'Eve Wilson',
  email: 'eve@example.com',
  age: 27
})

unsubscribe()

// Example 7: Filtered Queries
console.log('\n--- Filtered Queries ---')

// Get all active users
const activeUsers = users.where({ active: true })
const activeUnsubscribe = activeUsers.subscribe((userList) => {
  console.log('Active users:', userList.map(u => u.name))
})

// Get users with specific tags
const developers = users.where({ tags: ['developer'] })
const devUnsubscribe = developers.subscribe((userList) => {
  console.log('Developers:', userList.map(u => u.name))
})

activeUnsubscribe()
devUnsubscribe()

// Example 8: Collection Management
console.log('\n--- Collection Management ---')

// Retrieve collection by name
const retrievedUsers = getCollection<User>('users')
console.log('Retrieved users collection:', retrievedUsers ? 'Found' : 'Not found')

// Retrieve schema by name
const retrievedSchema = getSchema('users')
console.log('Retrieved user schema:', retrievedSchema ? 'Found' : 'Not found')

// Example 9: Advanced Schema with Custom Validation
console.log('\n--- Advanced Schema with Custom Validation ---')

const productSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  price: z.number().positive('Price must be positive'),
  category: z.enum(['electronics', 'clothing', 'books', 'food']),
  inStock: z.boolean().default(true),
  rating: z.number().min(0).max(5).default(0),
  reviews: z.array(z.object({
    userId: z.number(),
    rating: z.number().min(1).max(5),
    comment: z.string().optional()
  })).default([])
}).refine((data) => {
  // Custom validation: products with 0 stock should have price > 0
  if (!data.inStock && data.price <= 0) {
    return false
  }
  return true
}, {
  message: 'Out of stock products must have a positive price',
  path: ['price']
})

type Product = z.infer<typeof productSchema>

const products = defineCollection<Product>('products', productSchema)

// Valid product
products.insert({
  id: 1,
  name: 'Laptop',
  price: 999.99,
  category: 'electronics',
  rating: 4.5,
  reviews: [
    { userId: 1, rating: 5, comment: 'Great laptop!' },
    { userId: 2, rating: 4 }
  ]
})

// Invalid product (will fail custom validation)
const invalidProduct = products.tryInsert({
  id: 2,
  name: 'Out of Stock Item',
  price: 0,
  category: 'electronics',
  inStock: false
} as any)

if (!invalidProduct.success) {
  console.log('Custom validation failed:', invalidProduct.error)
}

console.log('Valid products:', products.getAll())

// Example 10: Schema Inheritance and Composition
console.log('\n--- Schema Inheritance and Composition ---')

// Base schema for all entities
const baseEntitySchema = z.object({
  id: z.number(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  createdBy: z.number().optional()
})

// Extend base schema for different entity types
const commentSchema = baseEntitySchema.extend({
  content: z.string().min(1, 'Comment cannot be empty'),
  postId: z.number(),
  authorId: z.number(),
  parentId: z.number().optional(), // For nested comments
  isEdited: z.boolean().default(false)
})

type Comment = z.infer<typeof commentSchema>

const comments = defineCollection<Comment>('comments', commentSchema)

// Insert comments
comments.insert({
  id: 1,
  content: 'Great post! Thanks for sharing.',
  postId: 1,
  authorId: 1
})

comments.insert({
  id: 2,
  content: 'I have a question about this.',
  postId: 1,
  authorId: 2,
  parentId: 1 // Reply to comment 1
})

console.log('All comments:', comments.getAll())

// Example 11: Error Handling Patterns
console.log('\n--- Error Handling Patterns ---')

const errorProneSchema = z.object({
  id: z.number(),
  value: z.string().refine(val => val !== 'error', 'Value cannot be "error"'),
  timestamp: z.date()
})

type ErrorProne = z.infer<typeof errorProneSchema>

const errorProne = defineCollection<ErrorProne>('errorProne', errorProneSchema)

// Test various error scenarios
const errorTests = [
  { id: 1, value: 'valid', timestamp: new Date() },
  { id: 2, value: 'error', timestamp: new Date() }, // Will fail custom validation
  { id: 'invalid', value: 'valid', timestamp: new Date() }, // Will fail type validation
  { id: 3, value: 'valid' } // Will fail (missing required field)
]

errorTests.forEach((test, index) => {
  console.log(`\nTest ${index + 1}:`)
  const result = errorProne.tryInsert(test as any)
  if (result.success) {
    console.log('✅ Success:', result.data)
  } else {
    console.log('❌ Error:', result.error)
  }
})

console.log('\n=== DefineCollection Examples Completed ===')
console.log('\nKey Features Demonstrated:')
console.log('- ✅ Zod schema validation with custom rules')
console.log('- ✅ Type-safe operations with TypeScript')
console.log('- ✅ Safe operations (tryInsert, tryUpdate, tryDelete)')
console.log('- ✅ Validation without insertion (validateInsert)')
console.log('- ✅ Reactive streams for live updates')
console.log('- ✅ Filtered queries with reactive updates')
console.log('- ✅ Collection and schema management')
console.log('- ✅ Advanced schemas with inheritance')
console.log('- ✅ Custom validation and error handling')
console.log('- ✅ Default values and optional fields') 