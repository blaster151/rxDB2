import { z } from 'zod'
import { reactive } from '../packages/engine/src/reactive'
import { zodMap } from '../packages/engine/src/operators/zodMap'
import { defineCollection } from '../packages/engine/src/database/defineCollection'

// Define schemas
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).max(120),
  active: z.boolean().default(true)
})

const postSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  content: z.string(),
  authorId: z.number(),
  published: z.boolean().default(false),
  tags: z.array(z.string()).default([])
})

type User = z.infer<typeof userSchema>
type Post = z.infer<typeof postSchema>

// Create collections
const users = defineCollection<User>('users', userSchema)
const posts = defineCollection<Post>('posts', postSchema)

// Example 1: Basic validation with zodMap
console.log('=== Example 1: Basic Validation ===')

const userStream = reactive<User>({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
const validatedUsers = zodMap(userStream, userSchema)

validatedUsers.subscribe(users => {
  console.log('Validated users:', users)
})

// This will throw an error (invalid email)
try {
  userStream.set({ id: 2, name: 'Bob', email: 'invalid-email', age: 30 })
} catch (error) {
  console.log('Validation error:', error.message)
}

// Example 2: Filtering invalid data
console.log('\n=== Example 2: Filtering Invalid Data ===')

const rawDataStream = reactive<any>({ id: 1, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true })
const filteredUsers = zodMap(rawDataStream, userSchema, { filterInvalid: true })

filteredUsers.subscribe(users => {
  console.log('Filtered users:', users)
})

// This will be filtered out (invalid age)
rawDataStream.set({ id: 3, name: 'David', email: 'david@example.com', age: 150 })

// Example 3: Database integration with reactive streams
console.log('\n=== Example 3: Database Integration ===')

// Insert some data using strict insert()
users.insert({ id: 1, name: 'Alice', email: 'alice@example.com', age: 25, active: true })
users.insert({ id: 2, name: 'Bob', email: 'bob@example.com', age: 30, active: true })

posts.insert({ 
  id: 1, 
  title: 'Hello World', 
  content: 'This is my first post', 
  authorId: 1 
})

posts.insert({ 
  id: 2, 
  title: 'Reactive Programming', 
  content: 'Learn about reactive streams', 
  authorId: 2 
})

// Example 3b: Safe insertion with tryInsert()
console.log('\n=== Example 3b: Safe Insertion ===')

const batchData = [
  { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, active: true },
  { id: 'invalid', name: 'David', email: 'david@example.com', age: 40 } as any,
  { id: 5, name: 'Eve', email: 'eve@example.com', age: 28, active: true }
]

const results = batchData.map(data => users.tryInsert(data))

results.forEach((result, index) => {
  if (result.success) {
    console.log(`✅ Inserted: ${result.data.name}`)
  } else {
    console.log(`❌ Failed to insert ${batchData[index].name}:`, result.error.message)
  }
})

// Example 3c: Validation without insertion
console.log('\n=== Example 3c: Validation Only ===')

const validationResults = batchData.map(data => users.validateInsert(data))

validationResults.forEach((result, index) => {
  if (result.success) {
    console.log(`✅ Valid: ${result.data.name} (not inserted)`)
  } else {
    console.log(`❌ Invalid: ${batchData[index].name} (not inserted)`)
  }
})

// Get live streams with validation
const liveUsers = users.live()
const livePosts = posts.live()

// Add extra validation layer
const validatedLiveUsers = zodMap(liveUsers, userSchema)
const validatedLivePosts = zodMap(livePosts, postSchema)

validatedLiveUsers.subscribe(users => {
  console.log('Live validated users:', users)
})

validatedLivePosts.subscribe(posts => {
  console.log('Live validated posts:', posts)
})

// Example 4: Complex filtering and validation
console.log('\n=== Example 4: Complex Filtering ===')

// Get active users
const activeUsers = users.where({ active: true })
const validatedActiveUsers = zodMap(activeUsers, userSchema)

validatedActiveUsers.subscribe(users => {
  console.log('Active validated users:', users)
})

// Example 5: Schema transformations
console.log('\n=== Example 5: Schema Transformations ===')

const transformSchema = z.object({
  id: z.number(),
  name: z.string().transform(name => name.toUpperCase()),
  email: z.string().email().transform(email => email.toLowerCase()),
  age: z.number().transform(age => age + 1) // Add 1 to age
})

const transformedUsers = zodMap(userStream, transformSchema)

transformedUsers.subscribe(users => {
  console.log('Transformed users:', users)
})

// Example 6: Error handling with detailed messages
console.log('\n=== Example 6: Error Handling ===')

const invalidDataStream = reactive<any>({ 
  id: 'not-a-number', 
  name: 123, 
  email: 'not-an-email',
  age: -5
})

const strictValidation = zodMap(invalidDataStream, userSchema)

try {
  strictValidation.subscribe(users => {
    console.log('This should not be called')
  })
} catch (error) {
  console.log('Detailed validation error:', error.message)
}

console.log('\n=== Integration Complete ===')
console.log('All examples demonstrate:')
console.log('- Schema validation with Zod')
console.log('- Reactive stream processing')
console.log('- Database integration')
console.log('- Error handling and filtering')
console.log('- Type safety throughout') 