import { z } from 'zod'
import { defineCollection } from '../packages/engine/src/database/defineCollection'

console.log('=== Runtime Type Safety for Reactive Queries ===')

// Define schema with strict validation
const NoteSchema = z.object({
  id: z.number(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
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

// Create collection with runtime type safety
const notes = defineCollection<Note>('notes', NoteSchema)

console.log('\n--- Type-Safe Insert Operations ---')

// ✅ Valid insert - TypeScript and runtime validation pass
try {
  notes.insert({
    id: 1,
    title: "Hello World",
    content: "This is my first note",
    authorId: 1,
    tags: ["intro", "first"],
    createdAt: new Date(),
    updatedAt: new Date(),
    published: false,
    metadata: {
      views: 0,
      likes: 0,
      category: "personal"
    }
  })
  console.log('✅ Valid insert successful')
} catch (error) {
  console.log('❌ Insert failed:', error.message)
}

// ❌ Invalid insert - Missing required fields
try {
  notes.insert({
    id: 2,
    title: "Missing content" // Missing content field
  } as any)
  console.log('❌ Should have failed - missing content')
} catch (error) {
  console.log('✅ Runtime validation caught error:', error.message)
}

// ❌ Invalid insert - Wrong types
try {
  notes.insert({
    id: "not-a-number", // Should be number
    title: "Invalid types",
    content: "Content here",
    authorId: 1
  } as any)
  console.log('❌ Should have failed - invalid types')
} catch (error) {
  console.log('✅ Runtime validation caught type error:', error.message)
}

// Safe insert with result handling
const safeResult = notes.tryInsert({
  id: 3,
  title: "Safe insert",
  content: "This uses tryInsert for safe handling",
  authorId: 1,
  published: true
})

if (safeResult.success) {
  console.log('✅ Safe insert successful:', safeResult.data.title)
} else {
  console.log('❌ Safe insert failed:', safeResult.error)
}

console.log('\n--- Type-Safe Query Operations ---')

// Add more notes for querying
notes.insert({
  id: 4,
  title: "Work Note",
  content: "Important work information",
  authorId: 1,
  tags: ["work", "important"],
  published: true,
  metadata: {
    views: 10,
    likes: 5,
    category: "work"
  }
})

notes.insert({
  id: 5,
  title: "Tutorial Note",
  content: "How to use reactive databases",
  authorId: 2,
  tags: ["tutorial", "database"],
  published: true,
  metadata: {
    views: 25,
    likes: 12,
    category: "tutorial"
  }
})

// Type-safe find operations
console.log('\n--- Find Operations ---')

// Find by exact match
const workNotes = notes.find({ 
  "metadata.category": "work" 
})
console.log('Work notes:', workNotes.map(n => n.title))

// Find by multiple criteria
const publishedNotes = notes.find({ 
  published: true,
  authorId: 1
})
console.log('Published notes by author 1:', publishedNotes.map(n => n.title))

// Type-safe liveQuery operations
console.log('\n--- LiveQuery Operations ---')

// Live query for published notes
const livePublishedNotes = notes.liveQuery({ published: true })

const unsubscribe = livePublishedNotes.subscribe((notes) => {
  console.log('Live published notes update:', notes.map(n => n.title))
})

// Add a new published note to see live updates
notes.insert({
  id: 6,
  title: "New Published Note",
  content: "This will trigger live query update",
  authorId: 1,
  published: true
})

unsubscribe()

console.log('\n--- Type-Safe Update Operations ---')

// ✅ Valid update
const updateResult = notes.tryUpdate(1, {
  title: "Updated Hello World",
  tags: ["updated", "intro"]
})

if (updateResult.success) {
  console.log('✅ Update successful:', updateResult.data.title)
} else {
  console.log('❌ Update failed:', updateResult.error)
}

// ❌ Invalid update - wrong types
const invalidUpdateResult = notes.tryUpdate(1, {
  title: 123, // Should be string
  authorId: "not-a-number" // Should be number
} as any)

if (!invalidUpdateResult.success) {
  console.log('✅ Runtime validation caught update error:', invalidUpdateResult.error)
}

console.log('\n--- Type-Safe Live Streams ---')

// Live stream of all notes
const allNotesLive = notes.live()

const liveUnsubscribe = allNotesLive.subscribe((notes) => {
  console.log('Live all notes update:', notes.length, 'notes')
  
  // Type-safe access to note properties
  notes.forEach(note => {
    // TypeScript knows these are the correct types
    console.log(`  - ${note.title} (${note.metadata.category})`)
    console.log(`    Views: ${note.metadata.views}, Likes: ${note.metadata.likes}`)
  })
})

// Add another note to see live updates
notes.insert({
  id: 7,
  title: "Live Stream Test",
  content: "Testing live stream updates",
  authorId: 2,
  published: false
})

liveUnsubscribe()

console.log('\n--- Advanced Type Safety Features ---')

// Type-safe filtering with complex queries
const complexQuery = notes.find({
  published: true,
  "metadata.category": "tutorial"
})

console.log('Complex query results:', complexQuery.map(n => ({
  title: n.title,
  category: n.metadata.category,
  engagement: n.metadata.views + n.metadata.likes
})))

// Type-safe live query with reactive updates
const tutorialNotesLive = notes.liveQuery({
  "metadata.category": "tutorial"
})

const tutorialUnsubscribe = tutorialNotesLive.subscribe((tutorialNotes) => {
  console.log('Live tutorial notes:', tutorialNotes.map(n => n.title))
  
  // Type-safe destructuring and mapping
  const noteSummaries = tutorialNotes.map(note => ({
    id: note.id,
    title: note.title,
    isPopular: note.metadata.views > 20
  }))
  
  console.log('Note summaries:', noteSummaries)
})

// Update a note to trigger live query
notes.tryUpdate(5, {
  "metadata.views": 30 // Make it popular
})

tutorialUnsubscribe()

console.log('\n--- Schema Validation at Runtime ---')

// Validate data without inserting
const validationResult = notes.validateInsert({
  id: 8,
  title: "Validation Test",
  content: "Testing validation without insertion",
  authorId: 1,
  metadata: {
    views: 0,
    likes: 0,
    category: "personal"
  }
})

if (validationResult.success) {
  console.log('✅ Validation passed:', validationResult.data.title)
  console.log('Note: Data was not inserted, only validated')
} else {
  console.log('❌ Validation failed:', validationResult.error)
}

console.log('\n--- Error Handling Patterns ---')

// Test various error scenarios
const errorTests = [
  {
    name: 'Missing required field',
    data: { id: 9, title: "Missing content" } as any
  },
  {
    name: 'Invalid type',
    data: { id: "string", title: "Title", content: "Content", authorId: 1 } as any
  },
  {
    name: 'Invalid enum value',
    data: { 
      id: 10, 
      title: "Title", 
      content: "Content", 
      authorId: 1,
      metadata: { views: 0, likes: 0, category: "invalid" } 
    } as any
  },
  {
    name: 'Duplicate ID',
    data: { id: 1, title: "Duplicate", content: "Content", authorId: 1 }
  }
]

errorTests.forEach(test => {
  console.log(`\nTesting: ${test.name}`)
  const result = notes.tryInsert(test.data)
  if (result.success) {
    console.log('❌ Should have failed')
  } else {
    console.log('✅ Correctly caught error:', result.error)
  }
})

console.log('\n--- Type Safety Benefits Summary ---')

console.log('\n✅ Compile-time benefits:')
console.log('- TypeScript catches type errors before runtime')
console.log('- Autocomplete and IntelliSense for all properties')
console.log('- Refactoring safety - schema changes break type checks')

console.log('\n✅ Runtime benefits:')
console.log('- All data validated against schema at runtime')
console.log('- Detailed error messages for validation failures')
console.log('- Safe operations with tryInsert/tryUpdate/tryDelete')
console.log('- Type-safe reactive streams and queries')

console.log('\n✅ Query benefits:')
console.log('- Type-safe filtering with Partial<T>')
console.log('- Live queries return properly typed Reactive<T[]>')
console.log('- Safe destructuring and mapping of query results')
console.log('- Runtime validation ensures data integrity')

console.log('\n=== Runtime Type Safety Example Completed ===') 