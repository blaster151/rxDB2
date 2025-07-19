import { z } from 'zod'
import { defineCollectionWithMigrations } from '../packages/engine/src/database/defineCollectionWithMigrations.js'

console.log('=== Simple Schema Migration Example ===\n')

// Define schemas
const UserSchemaV1 = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
})

const UserSchemaV2 = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  displayName: z.string()
})

// Simple migration
const userMigrations = {
  1: {
    migrate: (data: any[]) => {
      console.log('🔄 Applying migration: Adding displayName field')
      return data.map(user => ({
        ...user,
        displayName: user.name
      }))
    },
    description: 'Add displayName field'
  }
}

// Create collection
console.log('1. Creating collection with migration...')

const users = defineCollectionWithMigrations({
  name: 'users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  onMigrationError: 'warn',
  initialState: [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' }
  ]
})

console.log(`✅ Collection created with ${users.count} users`)
console.log(`📊 Current version: ${users.getCurrentVersion()}`)
console.log(`🎯 Target version: ${users.schemaVersion}`)

// Check status
console.log('\n2. Migration status:')
const status = users.getMigrationStatus()
console.log({
  currentVersion: status.currentVersion,
  targetVersion: status.targetVersion,
  needsMigration: status.needsMigration
})

// Manual migration
console.log('\n3. Running manual migration...')
const result = await users.migrateToVersion(2, false)
console.log('Migration result:', {
  success: result.success,
  version: result.version,
  migrationsApplied: result.migrationsApplied,
  warnings: result.warnings
})

// Query data
console.log('\n4. Querying migrated data:')
const allUsers = users.find()
allUsers.forEach(user => {
  console.log(`  - ${user.name} (${user.email}) - Display: ${user.displayName}`)
})

// Test CRUD operations
console.log('\n5. Testing CRUD operations:')

// Insert
const insertResult = users.tryInsert({
  id: '3',
  name: 'Charlie',
  email: 'charlie@example.com',
  displayName: 'Charlie'
})
console.log('Insert result:', insertResult.success)

// Update
const updateResult = users.tryUpdate('1', { displayName: 'Alice Updated' })
console.log('Update result:', updateResult.success)

// Query updated data
const updatedUser = users.findOne({ id: '1' })
console.log('Updated user:', updatedUser?.displayName)

console.log('\n🎯 Migration Features Demonstrated:')
console.log('✅ Schema versioning with migrations')
console.log('✅ Eager migration during collection load')
console.log('✅ Manual migration to specific versions')
console.log('✅ Migration status tracking')
console.log('✅ CRUD operations with migrated data')
console.log('✅ Error handling with warnings')
console.log('✅ Zod schema validation integration') 