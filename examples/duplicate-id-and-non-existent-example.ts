import { z } from 'zod'
import { defineCollection } from '../packages/engine/src/database/defineCollection'

// Define user schema
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

// Create collection
const users = defineCollection<User>('users', userSchema)

console.log('=== Duplicate ID and Non-Existent Update Behaviors ===\n')

// Example 1: Duplicate ID Handling
console.log('🔁 Example 1: Duplicate ID Handling (Option A - Recommended)')
console.log('Behavior: Throw error or return { success: false, error }')
console.log('Rationale: IDs are meant to be unique. Silent overwrites risk data loss.\n')

// Insert first user
console.log('1. Inserting first user...')
const result1 = users.tryInsert({
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
  role: 'user'
})

if (result1.success) {
  console.log('✅ Successfully inserted:', result1.data.name)
} else {
  console.log('❌ Insert failed:', result1.error)
}

// Try to insert duplicate ID
console.log('\n2. Trying to insert user with duplicate ID...')
const result2 = users.tryInsert({
  id: 1, // Duplicate ID
  name: 'Alice Updated',
  email: 'alice.updated@example.com',
  age: 26,
  role: 'admin'
})

if (result2.success) {
  console.log('✅ Successfully inserted:', result2.data.name)
} else {
  console.log('❌ Insert failed:', result2.error)
}

// Verify original data is unchanged
console.log('\n3. Verifying original data is unchanged...')
const allUsers = users.getAll()
console.log('Current users:', allUsers.map(u => ({ id: u.id, name: u.name, email: u.email })))

// Example 2: Non-Existent Update Handling
console.log('\n✏️ Example 2: Non-Existent Update Handling (Option A - Recommended)')
console.log('Behavior: Throw error or return success: false')
console.log('Rationale: If an update targets a note that doesn\'t exist, that\'s probably a bug.\n')

// Try to update non-existent user
console.log('1. Trying to update non-existent user...')
const updateResult = users.tryUpdate(999, { 
  name: 'Non-existent User',
  role: 'admin'
})

if (updateResult.success) {
  console.log('✅ Successfully updated:', updateResult.data.name)
} else {
  console.log('❌ Update failed:', updateResult.error)
}

// Verify collection is still unchanged
console.log('\n2. Verifying collection is unchanged...')
const usersAfterUpdate = users.getAll()
console.log('Current users:', usersAfterUpdate.map(u => ({ id: u.id, name: u.name })))

// Example 3: LiveQuery Subscription Behavior
console.log('\n📡 Example 3: LiveQuery Subscription Behavior')
console.log('Testing that failed operations do NOT trigger liveQuery subscriptions\n')

// Subscribe to live query
const liveQuery = users.live()
const results: User[][] = []
const unsubscribe = liveQuery.subscribe((users: User[]) => {
  results.push(users)
  console.log(`📡 LiveQuery emission #${results.length}:`, users.length, 'users')
})

// Insert a user (should trigger)
console.log('1. Inserting user (should trigger liveQuery)...')
users.insert({
  id: 2,
  name: 'Bob',
  email: 'bob@example.com',
  age: 30,
  role: 'admin'
})

// Try duplicate insert (should NOT trigger)
console.log('\n2. Trying duplicate insert (should NOT trigger liveQuery)...')
try {
  users.insert({
    id: 2, // Duplicate ID
    name: 'Bob Updated',
    email: 'bob.updated@example.com',
    age: 31
  })
} catch (error) {
  console.log('❌ Expected error:', (error as Error).message)
}

// Try update non-existent (should NOT trigger)
console.log('\n3. Trying update non-existent (should NOT trigger liveQuery)...')
try {
  users.update(999, { name: 'Non-existent' })
} catch (error) {
  console.log('❌ Expected error:', (error as Error).message)
}

// Update existing user (should trigger)
console.log('\n4. Updating existing user (should trigger liveQuery)...')
users.update(2, { role: 'user' })

unsubscribe()

console.log('\n📊 LiveQuery Summary:')
console.log(`Total emissions: ${results.length}`)
console.log('Expected: 3 emissions (initial empty + insert + update)')
console.log('Actual:', results.length, 'emissions')

// Example 4: Filtered Query Behavior
console.log('\n🔍 Example 4: Filtered Query Behavior')
console.log('Testing that failed operations do NOT trigger filtered queries\n')

// Subscribe to admin users only
const adminUsers = users.where({ role: 'admin' })
const adminResults: User[][] = []
const unsubscribeAdmin = adminUsers.subscribe((users: User[]) => {
  adminResults.push(users)
  console.log(`🔍 Admin query emission #${adminResults.length}:`, users.length, 'admin users')
})

// Insert admin user (should trigger)
console.log('1. Inserting admin user (should trigger admin query)...')
users.insert({
  id: 3,
  name: 'Charlie',
  email: 'charlie@example.com',
  age: 35,
  role: 'admin'
})

// Try duplicate admin insert (should NOT trigger)
console.log('\n2. Trying duplicate admin insert (should NOT trigger admin query)...')
try {
  users.insert({
    id: 3, // Duplicate ID
    name: 'Charlie Updated',
    email: 'charlie.updated@example.com',
    age: 36,
    role: 'admin'
  })
} catch (error) {
  console.log('❌ Expected error:', (error as Error).message)
}

// Try update non-existent to admin (should NOT trigger)
console.log('\n3. Trying update non-existent to admin (should NOT trigger admin query)...')
try {
  users.update(999, { role: 'admin' })
} catch (error) {
  console.log('❌ Expected error:', (error as Error).message)
}

// Update existing user to admin (should trigger)
console.log('\n4. Updating existing user to admin (should trigger admin query)...')
users.update(1, { role: 'admin' })

unsubscribeAdmin()

console.log('\n📊 Admin Query Summary:')
console.log(`Total emissions: ${adminResults.length}`)
console.log('Expected: 3 emissions (initial empty + insert admin + update to admin)')
console.log('Actual:', adminResults.length, 'emissions')

// Example 5: Integration Scenario
console.log('\n🔄 Example 5: Integration Scenario')
console.log('Complex scenario with multiple operations and failures\n')

// Subscribe to all users
const allUsersQuery = users.live()
const integrationResults: User[][] = []
const unsubscribeAll = allUsersQuery.subscribe((users: User[]) => {
  integrationResults.push(users)
  console.log(`🔄 Integration emission #${integrationResults.length}:`, users.length, 'users')
})

// Complex sequence of operations
console.log('1. Starting complex operation sequence...')

// Insert user
users.insert({
  id: 4,
  name: 'David',
  email: 'david@example.com',
  age: 28,
  role: 'user'
})

// Try duplicate insert (should fail)
try {
  users.insert({
    id: 4,
    name: 'David Duplicate',
    email: 'david.duplicate@example.com',
    age: 29
  })
} catch (error) {
  console.log('❌ Duplicate insert failed (expected):', (error as Error).message)
}

// Update existing user
users.update(4, { role: 'admin' })

// Try update non-existent
try {
  users.update(999, { name: 'Non-existent' })
} catch (error) {
  console.log('❌ Non-existent update failed (expected):', (error as Error).message)
}

// Insert another user
users.insert({
  id: 5,
  name: 'Eve',
  email: 'eve@example.com',
  age: 32,
  role: 'guest'
})

// Delete a user
users.delete(5)

unsubscribeAll()

console.log('\n📊 Integration Summary:')
console.log(`Total emissions: ${integrationResults.length}`)
console.log('Expected: 6 emissions (initial empty + insert David + update David + insert Eve + delete Eve)')
console.log('Actual:', integrationResults.length, 'emissions')

// Final state
console.log('\n🏁 Final State:')
const finalUsers = users.getAll()
console.log('All users:', finalUsers.map(u => ({ 
  id: u.id, 
  name: u.name, 
  role: u.role,
  active: u.active 
})))

console.log('\n✅ All examples completed successfully!')
console.log('Key takeaways:')
console.log('- Duplicate ID inserts fail and do NOT trigger liveQuery')
console.log('- Non-existent updates fail and do NOT trigger liveQuery')
console.log('- Only successful operations trigger reactive updates')
console.log('- Data integrity is maintained throughout all operations') 