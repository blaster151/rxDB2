import { z } from 'zod'
import { defineCollectionWithMigrations, defineStore } from '../packages/engine/src/database/defineCollectionWithMigrations.js'

console.log('=== Schema Migration Example ===\n')

// Define schemas for different versions
const UserSchemaV1 = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email()
})

const UserSchemaV2 = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  displayName: z.string() // New field
})

const UserSchemaV3 = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  fullName: z.string(), // Renamed from displayName
  preferences: z.object({
    theme: z.enum(['light', 'dark']).default('light')
  })
})

// Define migration functions
const userMigrations = {
  // Migration from v1 to v2: Add displayName
  1: {
    migrate: (data: any[]) => {
      console.log('🔄 Applying migration v1 → v2: Adding displayName field')
      return data.map(user => ({
        ...user,
        displayName: `${user.firstName} ${user.lastName}`
      }))
    },
    description: 'Add displayName field by combining firstName and lastName',
    validateWith: UserSchemaV2.array()
  },

  // Migration from v2 to v3: Rename displayName to fullName and add preferences
  2: {
    migrate: (data: any[]) => {
      console.log('🔄 Applying migration v2 → v3: Renaming displayName to fullName and adding preferences')
      return data.map(user => {
        const { displayName, ...rest } = user
        return {
          ...rest,
          fullName: displayName,
          preferences: { theme: 'light' }
        }
      })
    },
    description: 'Rename displayName to fullName and add preferences object',
    validateWith: UserSchemaV3.array()
  }
}

// Example 1: Basic migration with defineCollectionWithMigrations
console.log('1. Creating collection with migrations...')

const users = defineCollectionWithMigrations({
  name: 'users',
  schema: UserSchemaV3,
  schemaVersion: 3,
  migrations: userMigrations,
  onMigrationError: 'warn',
  validateAfterMigration: true,
  initialState: [
    { id: '1', firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com' },
    { id: '2', firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com' }
  ]
})

console.log(`✅ Collection created with ${users.count} initial users`)
console.log(`📊 Current version: ${users.getCurrentVersion()}`)
console.log(`🎯 Target version: ${users.schemaVersion}`)

// Example 2: Check migration status
console.log('\n2. Checking migration status...')

const status = users.getMigrationStatus()
console.log('Migration Status:', {
  currentVersion: status.currentVersion,
  targetVersion: status.targetVersion,
  needsMigration: status.needsMigration,
  lastMigration: status.lastMigration
})

// Example 3: Manual migration to specific version
console.log('\n3. Running manual migration...')

const migrateResult = await users.migrateToVersion(3, false) // false = not dry run
console.log('Migration Result:', {
  success: migrateResult.success,
  version: migrateResult.version,
  migrationsApplied: migrateResult.migrationsApplied,
  warnings: migrateResult.warnings,
  errors: migrateResult.errors
})

// Example 4: Dry run migration
console.log('\n4. Running dry run migration...')

const dryRunResult = await users.migrateToVersion(3, true) // true = dry run
console.log('Dry Run Result:', {
  success: dryRunResult.success,
  warnings: dryRunResult.warnings
})

// Example 5: Query migrated data
console.log('\n5. Querying migrated data...')

const allUsers = users.find()
console.log('All users after migration:')
allUsers.forEach(user => {
  console.log(`  - ${user.fullName} (${user.email}) - Theme: ${user.preferences.theme}`)
})

// Example 6: Using defineStore alias
console.log('\n6. Using defineStore alias...')

const posts = defineStore({
  name: 'posts',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    publishedAt: z.date().optional()
  }),
  schemaVersion: 1,
  onMigrationError: 'throw', // Different error strategy
  initialState: [
    { id: '1', title: 'Hello World', content: 'First post', authorId: '1' }
  ]
})

console.log(`✅ Store created with ${posts.count} initial posts`)

// Example 7: Error handling demonstration
console.log('\n7. Demonstrating error handling...')

try {
  // This will fail validation
  users.insert({
    id: '3',
    firstName: 'Invalid',
    lastName: 'User',
    email: 'not-an-email', // Invalid email
    fullName: 'Invalid User',
    preferences: { theme: 'light' }
  } as any)
} catch (error) {
  console.log('❌ Expected validation error:', error instanceof Error ? error.message : error)
}

// Example 8: Migration with different error strategies
console.log('\n8. Creating collection with different error strategy...')

const strictUsers = defineCollectionWithMigrations({
  name: 'strict-users',
  schema: UserSchemaV3,
  schemaVersion: 3,
  migrations: userMigrations,
  onMigrationError: 'throw', // Will throw on migration errors
  initialState: [
    { id: '1', firstName: 'Strict', lastName: 'User', email: 'strict@example.com' }
  ]
})

console.log(`✅ Strict collection created with ${strictUsers.count} users`)

// Example 9: Complex migration scenario
console.log('\n9. Complex migration scenario...')

// Define a more complex schema evolution
const ProductSchemaV1 = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number()
})

const ProductSchemaV2 = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
  category: z.string().optional()
})

const ProductSchemaV3 = z.object({
  id: z.string(),
  name: z.string(),
  price: z.object({
    amount: z.number(),
    currency: z.enum(['USD', 'EUR', 'GBP'])
  }),
  category: z.string().default('uncategorized'),
  tags: z.array(z.string()).default([])
})

const productMigrations = {
  1: {
    migrate: (data: any[]) => {
      console.log('🔄 Product migration v1 → v2: Adding currency and category')
      return data.map(product => ({
        ...product,
        currency: 'USD',
        category: undefined
      }))
    },
    description: 'Add currency field and optional category'
  },
  2: {
    migrate: (data: any[]) => {
      console.log('🔄 Product migration v2 → v3: Restructuring price and adding tags')
      return data.map(product => ({
        ...product,
        price: {
          amount: product.price,
          currency: product.currency
        },
        category: product.category || 'uncategorized',
        tags: []
      }))
    },
    description: 'Restructure price object and add tags array'
  }
}

const products = defineCollectionWithMigrations({
  name: 'products',
  schema: ProductSchemaV3,
  schemaVersion: 3,
  migrations: productMigrations,
  onMigrationError: 'warn',
  initialState: [
    { id: '1', name: 'Laptop', price: 999 },
    { id: '2', name: 'Mouse', price: 25 }
  ]
})

console.log(`✅ Products collection created with ${products.count} items`)

// Wait for migrations to complete
await new Promise(resolve => setTimeout(resolve, 100))

const allProducts = products.find()
console.log('Products after migration:')
allProducts.forEach(product => {
  console.log(`  - ${product.name}: ${product.price.amount} ${product.price.currency} (${product.category})`)
})

// Example 10: Migration utilities
console.log('\n10. Migration utilities...')

const collections = [users, posts, strictUsers, products]
collections.forEach(collection => {
  const status = collection.getMigrationStatus()
  console.log(`${collection.name}: v${status.currentVersion} → v${status.targetVersion} (${status.needsMigration ? 'needs migration' : 'up to date'})`)
})

console.log('\n🎯 Schema Migration Features Demonstrated:')
console.log('✅ Eager migration during collection load')
console.log('✅ Configurable error handling strategies')
console.log('✅ Optional Zod validation per migration step')
console.log('✅ Dry run mode for testing migrations')
console.log('✅ Manual migration to specific versions')
console.log('✅ Migration status tracking')
console.log('✅ Complex schema evolution support')
console.log('✅ Top-level metadata storage')
console.log('✅ Conditional persistence (only if changed)')
console.log('✅ Both defineCollection and defineStore APIs')

console.log('\n📈 Migration System Benefits:')
console.log('- 🛡️ Data integrity during schema evolution')
console.log('- 🔄 Automatic migration on collection load')
console.log('- 🧪 Safe testing with dry-run mode')
console.log('- ⚡ Performance optimized with conditional persistence')
console.log('- 🎛️ Flexible error handling for different scenarios')
console.log('- 📊 Comprehensive migration tracking and status')
console.log('- 🔧 Developer-friendly API with clear semantics') 