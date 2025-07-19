# Runtime Type Safety for Reactive Queries

## Overview

Our `defineCollection` implementation provides **complete runtime type safety** for reactive queries and data operations, using Zod schemas as the single source of truth. This ensures that all input/output objects in reactive APIs like `find()`, `liveQuery()`, `insert()`, etc. are structurally correct at both compile-time and runtime.

## Key Features

### 1. Schema-defined Types at Compile-time

TypeScript uses the schema to infer types automatically:

```typescript
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

// TypeScript knows these are the correct types
notes.insert({
  id: 1,           // number
  title: "Hello",  // string
  content: "World", // string
  authorId: 1      // number
  // Optional fields have defaults applied
})
```

### 2. Runtime Enforcement

All data operations validate against the schema at runtime:

```typescript
// ✅ Valid - passes both TypeScript and runtime validation
notes.insert({
  id: 1,
  title: "Hello World",
  content: "This is my first note",
  authorId: 1
})

// ❌ Invalid - runtime validation throws detailed error
try {
  notes.insert({
    id: 2,
    title: "Missing content" // Missing required content field
  } as any)
} catch (error) {
  console.log('Validation error:', error.message)
  // Output: "Invalid input: expected string, received undefined"
}

// ❌ Invalid types - caught at runtime
try {
  notes.insert({
    id: "not-a-number", // Should be number
    title: "Invalid types",
    content: "Content here",
    authorId: 1
  } as any)
} catch (error) {
  console.log('Type error:', error.message)
  // Output: "Invalid input: expected number, received string"
}
```

### 3. Type-safe Reactive Results

Reactive queries return properly typed results:

```typescript
// Type-safe live query
const livePublishedNotes = notes.liveQuery({ published: true })

const unsubscribe = livePublishedNotes.subscribe((notes) => {
  // TypeScript knows each note has the correct structure
  notes.forEach(note => {
    console.log(note.title)        // string
    console.log(note.metadata.views) // number
    console.log(note.metadata.category) // 'personal' | 'work' | 'tutorial'
  })
})

// Type-safe find operations
const workNotes = notes.find({ 
  "metadata.category": "work" 
})

// Safe destructuring and mapping
const noteSummaries = workNotes.map(({ id, title, metadata }) => ({
  id,
  title,
  isPopular: metadata.views > 20
}))
```

## API Reference

### Collection Interface

```typescript
interface Collection<T> {
  // Type-safe insert operations
  insert: (item: T) => void
  tryInsert: (item: T) => InsertResult<T>
  validateInsert: (item: T) => InsertResult<T>
  
  // Type-safe update operations
  update: (id: T extends { id: infer ID } ? ID : never, updates: Partial<T>) => UpdateResult<T>
  tryUpdate: (id: T extends { id: infer ID } ? ID : never, updates: Partial<T>) => UpdateResult<T>
  
  // Type-safe delete operations
  delete: (id: T extends { id: infer ID } ? ID : never) => DeleteResult<T>
  tryDelete: (id: T extends { id: infer ID } ? ID : never) => DeleteResult<T>
  
  // Type-safe query operations
  getAll: () => T[]
  live: () => QueryResult<T>
  find: (filter: Partial<T>) => T[]
  liveQuery: (filter: Partial<T>) => QueryResult<T>
  
  // Schema access
  schema: ZodSchema<T>
}
```

### Result Types

```typescript
type InsertResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError | string }

type UpdateResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError | string }

type DeleteResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

type QueryResult<T> = Reactive<T[]>
```

## Benefits

### 1. Eliminates Runtime Bugs

- **Malformed updates**: Invalid data is caught before insertion
- **Type mismatches**: Wrong types are detected at runtime
- **Missing fields**: Required fields are enforced
- **Invalid enums**: Only valid enum values are accepted

### 2. Enables Confident Refactoring

```typescript
// Initial schema
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email()
})

// Later, add a required field
const NewUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number() // New required field
})

// TypeScript will catch this:
// users.insert({ id: 1, name: "John", email: "john@example.com" }) // Missing age

// Runtime validation will also catch it
const result = users.tryInsert({ id: 1, name: "John", email: "john@example.com" } as any)
// result.success === false
```

### 3. Safe Destructuring and Mapping

```typescript
const books = defineCollection<Book>('books', BookSchema)

// Type-safe filtering
const fictionBooks = books.find({ genre: "fiction" })

// Safe destructuring with optional fields
const bookSummaries = fictionBooks.map(({ id, title, author, rating }) => ({
  id,
  title,
  author,
  hasRating: rating !== undefined,
  rating: rating || 'Not rated'
}))
```

## Advanced Features

### 1. Complex Validation

```typescript
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
  // Custom validation: express shipping requires minimum order amount
  if (data.shippingMethod === 'express' && data.totalAmount < 50) {
    return false
  }
  return true
}, {
  message: 'Express shipping requires minimum order of $50',
  path: ['shippingMethod']
})
```

### 2. Nested Object Validation

```typescript
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
  addresses: z.array(AddressSchema).min(1, 'At least one address required')
})
```

### 3. Optional Fields with Defaults

```typescript
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

// Safe handling of optional fields
const profileInfo = profiles.map(profile => ({
  username: profile.username,
  hasBio: profile.bio !== undefined,
  bioLength: profile.bio?.length || 0,
  theme: profile.preferences?.theme || 'light'
}))
```

## Error Handling

### 1. Safe Operations

```typescript
// Use tryInsert for safe error handling
const result = notes.tryInsert({
  id: 1,
  title: "Test",
  content: "Content",
  authorId: 1
})

if (result.success) {
  console.log('Inserted:', result.data)
} else {
  console.log('Error:', result.error)
}
```

### 2. Validation Without Insertion

```typescript
// Validate data without inserting
const validationResult = notes.validateInsert({
  id: 1,
  title: "Test",
  content: "Content",
  authorId: 1
})

if (validationResult.success) {
  console.log('Data is valid:', validationResult.data)
  // Note: Data was not inserted, only validated
}
```

## Performance Considerations

- **Schema validation** happens only on write operations (insert/update)
- **Read operations** (find/liveQuery) are fast and don't require validation
- **Reactive streams** are optimized for real-time updates
- **Type checking** is done at compile-time, not runtime

## Best Practices

1. **Use descriptive error messages** in schema definitions
2. **Provide sensible defaults** for optional fields
3. **Use tryInsert/tryUpdate** for safe error handling
4. **Validate data early** with validateInsert before processing
5. **Leverage TypeScript** for compile-time type checking
6. **Use discriminated unions** for complex data structures

## Example Usage

```typescript
import { z } from 'zod'
import { defineCollection } from './database/defineCollection'

// Define schema with validation
const NoteSchema = z.object({
  id: z.number(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
  authorId: z.number()
})

type Note = z.infer<typeof NoteSchema>

// Create collection with runtime type safety
const notes = defineCollection<Note>('notes', NoteSchema)

// Type-safe operations
notes.insert({
  id: 1,
  title: "Hello World",
  content: "This is my first note",
  authorId: 1
})

// Type-safe queries
const publishedNotes = notes.liveQuery({ published: true })
const unsubscribe = publishedNotes.subscribe(notes => {
  notes.forEach(note => {
    console.log(`${note.title}: ${note.content}`)
  })
})

// Type-safe updates
const updateResult = notes.tryUpdate(1, {
  title: "Updated Title",
  published: true
})

if (updateResult.success) {
  console.log('Updated:', updateResult.data)
} else {
  console.log('Update failed:', updateResult.error)
}
```

This implementation provides **complete runtime type safety** while maintaining excellent performance and developer experience. All data operations are validated against the schema, ensuring data integrity and preventing runtime errors. 