# Schema Migration System

The schema migration system provides robust support for evolving your data schemas over time while maintaining data integrity and backward compatibility. This is essential for production applications where schema changes must be handled gracefully.

## Features

- ✅ **Eager Migration**: Automatic migration during collection load
- ✅ **Configurable Error Handling**: warn, throw, fallback, or dry-run strategies
- ✅ **Zod Integration**: Optional validation per migration step
- ✅ **Dry Run Mode**: Test migrations without applying changes
- ✅ **Manual Migration**: Migrate to specific versions on demand
- ✅ **Migration Tracking**: Comprehensive status and history
- ✅ **Top-level Metadata**: Clean separation of version info from domain data
- ✅ **Conditional Persistence**: Only persist when data actually changes

## Quick Start

### Basic Migration Setup

```typescript
import { defineCollectionWithMigrations } from '@rxdb2/engine'
import { z } from 'zod'

// Define schemas for different versions
const UserSchemaV1 = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
})

const UserSchemaV2 = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  displayName: z.string() // New field
})

// Define migration functions
const userMigrations = {
  1: {
    migrate: (data) => data.map(user => ({
      ...user,
      displayName: user.name
    })),
    description: 'Add displayName field'
  }
}

// Create collection with migrations
const users = defineCollectionWithMigrations({
  name: 'users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  initialState: [
    { id: '1', name: 'Alice', email: 'alice@example.com' }
  ]
})
```

### Using the defineStore Alias

```typescript
import { defineStore } from '@rxdb2/engine'

const userStore = defineStore({
  name: 'user-store',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations
})
```

## API Reference

### defineCollectionWithMigrations(config)

Creates a collection with schema versioning and migration support.

#### Configuration Options

```typescript
interface CollectionConfig<T> {
  name: string                    // Collection name
  schema: ZodSchema<T>           // Current schema
  schemaVersion: number          // Current schema version
  migrations?: MigrationTable<T> // Migration functions
  onMigrationError?: 'warn' | 'throw' | 'fallback' | 'dry-run'
  validateAfterMigration?: boolean
  initialState?: T[]
}
```

### Migration Table Structure

```typescript
type MigrationTable<T> = Record<number, MigrationStep<T>>

interface MigrationStep<T> {
  migrate: (data: T) => T        // Migration function
  validateWith?: ZodSchema<T>    // Optional validation
  description?: string           // Human-readable description
  requiresPersistence?: boolean  // Override persistence behavior
}
```

## Migration Strategies

### 1. Simple Field Addition

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({
      ...item,
      createdAt: new Date().toISOString()
    })),
    description: 'Add createdAt timestamp to all items'
  }
}
```

### 2. Field Renaming

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => {
      const { oldFieldName, ...rest } = item
      return {
        ...rest,
        newFieldName: oldFieldName
      }
    }),
    description: 'Rename oldFieldName to newFieldName'
  }
}
```

### 3. Complex Transformations

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({
      ...item,
      fullName: `${item.firstName} ${item.lastName}`,
      preferences: {
        theme: 'light',
        notifications: true
      }
    })),
    description: 'Add fullName and preferences object'
  }
}
```

### 4. Data Structure Changes

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({
      ...item,
      price: {
        amount: item.price,
        currency: 'USD'
      }
    })),
    description: 'Convert price from number to object structure'
  }
}
```

## Error Handling Strategies

### Warn (Default)

```typescript
const collection = defineCollectionWithMigrations({
  name: 'users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  onMigrationError: 'warn' // Logs warnings but continues
})
```

### Throw

```typescript
const collection = defineCollectionWithMigrations({
  name: 'critical-users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  onMigrationError: 'throw' // Throws error on migration failure
})
```

### Fallback

```typescript
const collection = defineCollectionWithMigrations({
  name: 'resilient-users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  onMigrationError: 'fallback' // Uses fallback data on failure
})
```

### Dry Run

```typescript
const collection = defineCollectionWithMigrations({
  name: 'test-users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  onMigrationError: 'dry-run' // Logs what would happen without applying
})
```

## Migration Operations

### Manual Migration

```typescript
// Migrate to specific version
const result = await users.migrateToVersion(3, false)
console.log('Migration result:', result)

// Dry run migration
const dryRunResult = await users.migrateToVersion(3, true)
console.log('Dry run warnings:', dryRunResult.warnings)
```

### Migration Status

```typescript
const status = users.getMigrationStatus()
console.log({
  currentVersion: status.currentVersion,
  targetVersion: status.targetVersion,
  needsMigration: status.needsMigration,
  lastMigration: status.lastMigration
})
```

### Current Version

```typescript
const version = users.getCurrentVersion()
console.log(`Current schema version: ${version}`)
```

## Validation Integration

### Per-Migration Validation

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({
      ...item,
      displayName: item.name
    })),
    validateWith: UserSchemaV2.array(), // Validate after migration
    description: 'Add displayName with validation'
  }
}
```

### Global Validation

```typescript
const collection = defineCollectionWithMigrations({
  name: 'users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  validateAfterMigration: true // Validate all migrations
})
```

## Advanced Patterns

### Conditional Migrations

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => {
      // Only migrate if field doesn't exist
      if (!item.hasOwnProperty('displayName')) {
        return { ...item, displayName: item.name }
      }
      return item
    }),
    description: 'Add displayName only if missing'
  }
}
```

### Batch Processing

```typescript
const migrations = {
  1: {
    migrate: (data) => {
      // Process in batches for large datasets
      const batchSize = 1000
      const result = []
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize)
        const migratedBatch = batch.map(item => ({
          ...item,
          processed: true
        }))
        result.push(...migratedBatch)
      }
      
      return result
    },
    description: 'Process large dataset in batches'
  }
}
```

### Migration with Dependencies

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({
      ...item,
      displayName: item.name
    })),
    description: 'Add displayName'
  },
  2: {
    migrate: (data) => data.map(item => {
      // Migration 2 depends on migration 1
      if (!item.displayName) {
        throw new Error('displayName field required for migration 2')
      }
      return {
        ...item,
        fullName: item.displayName
      }
    }),
    description: 'Convert displayName to fullName'
  }
}
```

## Testing Migrations

### Unit Testing Individual Migrations

```typescript
import { runMigrations } from '@rxdb2/engine'

describe('User Migrations', () => {
  it('should migrate from v1 to v2 correctly', async () => {
    const oldData = [
      { id: '1', name: 'Alice', email: 'alice@test.com' }
    ]

    const result = await runMigrations(
      oldData,
      0,
      1,
      userMigrations,
      { collectionName: 'test', errorStrategy: 'throw' }
    )

    expect(result.success).toBe(true)
    expect(result.data[0]).toHaveProperty('displayName')
    expect(result.data[0].displayName).toBe('Alice')
  })
})
```

### Integration Testing

```typescript
describe('Collection Migration', () => {
  it('should handle migration during collection creation', () => {
    const collection = defineCollectionWithMigrations({
      name: 'test-users',
      schema: UserSchemaV2,
      schemaVersion: 2,
      migrations: userMigrations,
      initialState: [
        { id: '1', name: 'Alice', email: 'alice@test.com' }
      ]
    })

    expect(collection.getCurrentVersion()).toBe(2)
    expect(collection.count).toBe(1)
    
    const user = collection.findOne({ id: '1' })
    expect(user!.displayName).toBe('Alice')
  })
})
```

## Best Practices

### 1. Write Pure Migration Functions

```typescript
// ✅ Good: Pure function
const goodMigration = (data) => data.map(item => ({
  ...item,
  newField: 'default'
}))

// ❌ Bad: Side effects
const badMigration = (data) => {
  console.log('Migrating...') // Side effect
  return data.map(item => ({ ...item, newField: 'default' }))
}
```

### 2. Use Descriptive Migration Names

```typescript
const migrations = {
  1: {
    migrate: addDisplayName,
    description: 'Add displayName field by combining firstName and lastName'
  },
  2: {
    migrate: restructurePrice,
    description: 'Convert price from number to {amount, currency} object'
  }
}
```

### 3. Validate Migration Results

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({ ...item, displayName: item.name })),
    validateWith: UserSchemaV2.array(), // Ensure output is valid
    description: 'Add displayName with validation'
  }
}
```

### 4. Handle Edge Cases

```typescript
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({
      ...item,
      displayName: item.name || 'Unknown' // Handle missing name
    })),
    description: 'Add displayName with fallback for missing names'
  }
}
```

### 5. Test Migration Paths

```typescript
// Test migration from each version to latest
for (let fromVersion = 0; fromVersion < 3; fromVersion++) {
  it(`should migrate from v${fromVersion} to v3`, async () => {
    const result = await runMigrations(
      testData[fromVersion],
      fromVersion,
      3,
      migrations
    )
    expect(result.success).toBe(true)
  })
}
```

## Migration Lifecycle

### 1. Development Phase

```typescript
// Create migration
const migrations = {
  1: {
    migrate: (data) => data.map(item => ({ ...item, newField: 'default' })),
    description: 'Add newField'
  }
}

// Test with dry run
const result = await collection.migrateToVersion(2, true)
console.log('Dry run warnings:', result.warnings)
```

### 2. Production Deployment

```typescript
// Deploy with migration
const collection = defineCollectionWithMigrations({
  name: 'users',
  schema: UserSchemaV2,
  schemaVersion: 2,
  migrations: userMigrations,
  onMigrationError: 'warn' // Safe for production
})
```

### 3. Monitoring

```typescript
// Monitor migration status
const status = collection.getMigrationStatus()
if (status.needsMigration) {
  console.warn(`Collection ${collection.name} needs migration`)
}
```

## Troubleshooting

### Common Issues

1. **Missing Migration**: Ensure all versions from 0 to targetVersion have migrations
2. **Validation Failures**: Check that migration output matches expected schema
3. **Side Effects**: Ensure migration functions are pure and don't modify external state
4. **Performance**: Use batch processing for large datasets

### Debug Commands

```typescript
// Check migration status
console.log(collection.getMigrationStatus())

// Run dry run to see what would happen
const dryRun = await collection.migrateToVersion(3, true)
console.log(dryRun.warnings)

// Check current version
console.log(collection.getCurrentVersion())
```

The schema migration system provides a robust foundation for evolving your data schemas while maintaining data integrity and providing excellent developer experience. 