import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import { defineCollectionWithMigrations } from '../database/defineCollectionWithMigrations.js'
import { runMigrations, createVersionedData, needsMigration } from '../migration/migration-runner.js'

// Test schemas
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

const UserSchemaV3 = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  fullName: z.string(),
  preferences: z.object({
    theme: z.enum(['light', 'dark'])
  })
})

// Test migrations
const userMigrations = {
  1: {
    migrate: (data: any[]) => data.map(user => ({
      ...user,
      displayName: user.name
    })),
    description: 'Add displayName field'
  },
  2: {
    migrate: (data: any[]) => data.map(user => {
      const { displayName, ...rest } = user
      return {
        ...rest,
        fullName: displayName,
        preferences: { theme: 'light' }
      }
    }),
    description: 'Rename displayName to fullName and add preferences'
  }
}

describe('Schema Migration System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Migration Runner', () => {
    it('should run migrations in sequence', async () => {
      const initialData = [
        { id: '1', name: 'Alice', email: 'alice@test.com' }
      ]

      const result = await runMigrations(
        initialData,
        0,
        2,
        userMigrations,
        { collectionName: 'test', errorStrategy: 'warn' }
      )

      expect(result.success).toBe(true)
      expect(result.version).toBe(2)
      expect(result.migrationsApplied).toEqual([0, 1])
      expect(result.data).toEqual([
        {
          id: '1',
          name: 'Alice',
          email: 'alice@test.com',
          fullName: 'Alice',
          preferences: { theme: 'light' }
        }
      ])
    })

    it('should handle missing migrations', async () => {
      const initialData = [{ id: '1', name: 'Test' }]

      const result = await runMigrations(
        initialData,
        0,
        3,
        userMigrations,
        { collectionName: 'test', errorStrategy: 'warn' }
      )

      expect(result.success).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].error.message).toContain('Missing migration from v2 to v3')
    })

    it('should handle dry run mode', async () => {
      const initialData = [{ id: '1', name: 'Test', email: 'test@test.com' }]

      const result = await runMigrations(
        initialData,
        0,
        1,
        userMigrations,
        { collectionName: 'test', errorStrategy: 'warn', dryRun: true }
      )

      expect(result.success).toBe(true)
      expect(result.warnings.some(w => w.includes('[DRY RUN]'))).toBe(true)
    })

    it('should validate with Zod schema when provided', async () => {
      const migrationsWithValidation = {
        1: {
          ...userMigrations[1],
          validateWith: UserSchemaV2.array()
        }
      }

      const initialData = [{ id: '1', name: 'Test', email: 'test@test.com' }]

      const result = await runMigrations(
        initialData,
        0,
        1,
        migrationsWithValidation,
        { collectionName: 'test', errorStrategy: 'warn' }
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual([
        { id: '1', name: 'Test', email: 'test@test.com', displayName: 'Test' }
      ])
    })

    it('should fail validation if data is invalid', async () => {
      const migrationsWithValidation = {
        1: {
          ...userMigrations[1],
          validateWith: UserSchemaV2.array()
        }
      }

      const invalidData = [{ id: '1', name: 'Test' }] // Missing email

      const result = await runMigrations(
        invalidData,
        0,
        1,
        migrationsWithValidation,
        { collectionName: 'test', errorStrategy: 'warn' }
      )

      expect(result.success).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].error.message).toContain('validation failed')
    })
  })

  describe('Versioned Data Utilities', () => {
    it('should create versioned data', () => {
      const data = { id: '1', name: 'Test' }
      const versioned = createVersionedData(data, 2)

      expect(versioned._meta.version).toBe(2)
      expect(versioned.data).toEqual(data)
      expect(versioned._meta.migratedAt).toBeInstanceOf(Date)
    })

    it('should detect when migration is needed', () => {
      const versioned = createVersionedData({}, 1)
      
      expect(needsMigration(versioned, 2)).toBe(true)
      expect(needsMigration(versioned, 1)).toBe(false)
      expect(needsMigration(null, 1)).toBe(false)
    })
  })

  describe('defineCollectionWithMigrations', () => {
    it('should create collection with migrations', () => {
      const collection = defineCollectionWithMigrations({
        name: 'test-users',
        schema: UserSchemaV3,
        schemaVersion: 3,
        migrations: userMigrations,
        initialState: [
          { id: '1', name: 'Alice', email: 'alice@test.com' }
        ]
      })

      expect(collection.name).toBe('test-users')
      expect(collection.schemaVersion).toBe(3)
      expect(collection.count).toBe(1)
    })

    it('should validate migration table on creation', () => {
      const invalidMigrations = {
        1: userMigrations[1]
        // Missing migration 2
      }

      expect(() => {
        defineCollectionWithMigrations({
          name: 'invalid',
          schema: UserSchemaV3,
          schemaVersion: 3,
          migrations: invalidMigrations
        })
      }).toThrow('Invalid migration table')
    })

    it('should handle migration errors gracefully', async () => {
      const failingMigrations = {
        1: {
          migrate: () => {
            throw new Error('Migration failed')
          },
          description: 'Failing migration'
        }
      }

      const collection = defineCollectionWithMigrations({
        name: 'failing',
        schema: UserSchemaV2,
        schemaVersion: 2,
        migrations: failingMigrations,
        onMigrationError: 'warn',
        initialState: [{ id: '1', name: 'Test', email: 'test@test.com' }]
      })

      // Wait for async migration
      await new Promise(resolve => setTimeout(resolve, 50))

      const status = collection.getMigrationStatus()
      expect(status.currentVersion).toBe(0) // Should remain at initial version
    })

    it('should throw on migration errors when configured', () => {
      const failingMigrations = {
        1: {
          migrate: () => {
            throw new Error('Migration failed')
          },
          description: 'Failing migration'
        }
      }

      expect(() => {
        defineCollectionWithMigrations({
          name: 'failing-strict',
          schema: UserSchemaV2,
          schemaVersion: 2,
          migrations: failingMigrations,
          onMigrationError: 'throw',
          initialState: [{ id: '1', name: 'Test', email: 'test@test.com' }]
        })
      }).toThrow('Migration failed')
    })

    it('should support manual migration', async () => {
      const collection = defineCollectionWithMigrations({
        name: 'manual',
        schema: UserSchemaV3,
        schemaVersion: 3,
        migrations: userMigrations,
        initialState: [
          { id: '1', name: 'Alice', email: 'alice@test.com' }
        ]
      })

      const result = await collection.migrateToVersion(2, false)
      
      expect(result.success).toBe(true)
      expect(result.version).toBe(2)
      expect(result.migrationsApplied).toEqual([0, 1])
    })

    it('should support dry run migration', async () => {
      const collection = defineCollectionWithMigrations({
        name: 'dry-run',
        schema: UserSchemaV3,
        schemaVersion: 3,
        migrations: userMigrations,
        initialState: [
          { id: '1', name: 'Alice', email: 'alice@test.com' }
        ]
      })

      const result = await collection.migrateToVersion(2, true) // dry run
      
      expect(result.success).toBe(true)
      expect(result.warnings.some(w => w.includes('[DRY RUN]'))).toBe(true)
    })

    it('should track migration status', () => {
      const collection = defineCollectionWithMigrations({
        name: 'status',
        schema: UserSchemaV3,
        schemaVersion: 3,
        migrations: userMigrations,
        initialState: []
      })

      const status = collection.getMigrationStatus()
      
      expect(status.currentVersion).toBe(0)
      expect(status.targetVersion).toBe(3)
      expect(status.needsMigration).toBe(true)
      expect(status.migrationErrors).toEqual([])
    })

    it('should maintain CRUD operations after migration', async () => {
      const collection = defineCollectionWithMigrations({
        name: 'crud',
        schema: UserSchemaV3,
        schemaVersion: 3,
        migrations: userMigrations,
        initialState: []
      })

      // Insert data
      const insertResult = collection.tryInsert({
        id: '1',
        name: 'Alice',
        email: 'alice@test.com',
        fullName: 'Alice Test',
        preferences: { theme: 'light' }
      })

      expect(insertResult.success).toBe(true)
      expect(collection.count).toBe(1)

      // Query data
      const found = collection.findOne({ id: '1' })
      expect(found).toBeDefined()
      expect(found!.name).toBe('Alice')

      // Update data
      const updateResult = collection.tryUpdate('1', { name: 'Alice Updated' })
      expect(updateResult.success).toBe(true)
      expect(collection.findOne({ id: '1' })!.name).toBe('Alice Updated')

      // Delete data
      const deleteResult = collection.tryDelete('1')
      expect(deleteResult.success).toBe(true)
      expect(collection.count).toBe(0)
    })
  })

  describe('Error Handling Strategies', () => {
    it('should handle warn strategy', async () => {
      const failingMigrations = {
        1: {
          migrate: () => {
            throw new Error('Test error')
          },
          description: 'Failing migration'
        }
      }

      const collection = defineCollectionWithMigrations({
        name: 'warn-test',
        schema: UserSchemaV2,
        schemaVersion: 2,
        migrations: failingMigrations,
        onMigrationError: 'warn',
        initialState: [{ id: '1', name: 'Test', email: 'test@test.com' }]
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const status = collection.getMigrationStatus()
      expect(status.currentVersion).toBe(0) // Should remain at initial version
    })

    it('should handle fallback strategy', async () => {
      const failingMigrations = {
        1: {
          migrate: () => {
            throw new Error('Test error')
          },
          description: 'Failing migration'
        }
      }

      const collection = defineCollectionWithMigrations({
        name: 'fallback-test',
        schema: UserSchemaV2,
        schemaVersion: 2,
        migrations: failingMigrations,
        onMigrationError: 'fallback',
        initialState: [{ id: '1', name: 'Test', email: 'test@test.com' }]
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const status = collection.getMigrationStatus()
      expect(status.currentVersion).toBe(0) // Should remain at initial version
    })
  })

  describe('Migration Validation', () => {
    it('should validate migration results with Zod', async () => {
      const migrationsWithValidation = {
        1: {
          ...userMigrations[1],
          validateWith: UserSchemaV2.array()
        }
      }

      const collection = defineCollectionWithMigrations({
        name: 'validation-test',
        schema: UserSchemaV2,
        schemaVersion: 2,
        migrations: migrationsWithValidation,
        initialState: [
          { id: '1', name: 'Alice', email: 'alice@test.com' }
        ]
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const users = collection.find()
      expect(users[0]).toHaveProperty('displayName')
      expect(users[0].displayName).toBe('Alice')
    })
  })
}) 