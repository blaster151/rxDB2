// ESM Usage Example - Demonstrating tree-shaking and type safety
// This example shows how to use the library with ESM imports

import { z } from 'zod'
import { 
  defineReactiveCollection, 
  reactive, 
  type Collection, 
  type InsertResult 
} from '../src/index.js'

// Define a schema with Zod
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  age: z.number().min(0, 'Age must be positive'),
  createdAt: z.date(),
  updatedAt: z.date()
})

type User = z.infer<typeof UserSchema>

console.log('=== ESM Usage Example ===')

// Create a reactive collection
const users = defineReactiveCollection<User>('users', UserSchema)

console.log('\n--- Tree-shakable imports ---')
console.log('✅ Only imported functions are included in bundle')
console.log('✅ Unused exports are eliminated during build')

// Demonstrate safe operations with result objects
console.log('\n--- Safe Operations ---')

// Safe insert with result object
const insertResult: InsertResult<User> = users.tryInsert({
  id: crypto.randomUUID(),
  name: 'Alice Johnson',
  email: 'alice@example.com',
  age: 25,
  createdAt: new Date(),
  updatedAt: new Date()
})

if (insertResult.success) {
  console.log('✅ Insert successful:', insertResult.data.name)
} else {
  console.log('❌ Insert failed:', insertResult.error)
}

// Safe update with result object
const updateResult = users.tryUpdate(insertResult.success ? insertResult.data.id : '', {
  name: 'Alice Smith',
  age: 26
})

if (updateResult.success) {
  console.log('✅ Update successful:', updateResult.data.name, 'age:', updateResult.data.age)
} else {
  console.log('❌ Update failed:', updateResult.error)
}

// Reactive queries
console.log('\n--- Reactive Queries ---')

// Live query that updates automatically
const liveUsers = users.liveQuery({ age: 25 })
console.log('✅ Live query created - will update automatically')

// Subscribe to changes
liveUsers.subscribe(users => {
  console.log('🔄 Live query updated:', users.length, 'users with age 25')
})

// Add another user to trigger live query update
users.tryInsert({
  id: crypto.randomUUID(),
  name: 'Bob Wilson',
  email: 'bob@example.com',
  age: 25,
  createdAt: new Date(),
  updatedAt: new Date()
})

console.log('\n--- Type Safety ---')
console.log('✅ Full TypeScript support with Zod schema inference')
console.log('✅ Runtime validation with detailed error messages')
console.log('✅ Compile-time type checking for all operations')

// Demonstrate type safety
const typedCollection: Collection<User> = users
console.log('✅ Collection is fully typed:', typeof typedCollection.insert === 'function')

console.log('\n--- ESM Benefits ---')
console.log('✅ Native ES modules support')
console.log('✅ Tree-shaking eliminates unused code')
console.log('✅ Better bundler optimization')
console.log('✅ Modern JavaScript features')

console.log('\n=== ESM Example Complete ===') 