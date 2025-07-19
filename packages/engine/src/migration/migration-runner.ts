import type { 
  MigrationTable, 
  MigrationResult, 
  MigrationError, 
  MigrationContext,
  MigrationErrorStrategy,
  VersionedData
} from './types.js'

/**
 * Core migration runner that executes migrations in sequence
 */
export async function runMigrations<T>(
  data: T,
  fromVersion: number,
  toVersion: number,
  migrations: MigrationTable<T>,
  context?: Partial<MigrationContext>
): Promise<MigrationResult<T>> {
  const ctx: MigrationContext = {
    collectionName: 'unknown',
    currentVersion: fromVersion,
    targetVersion: toVersion,
    dryRun: false,
    errorStrategy: 'warn',
    ...context
  }

  const result: MigrationResult<T> = {
    success: true,
    data,
    version: fromVersion,
    migrationsApplied: [],
    errors: [],
    warnings: []
  }

  // No migration needed
  if (fromVersion === toVersion) {
    return result
  }

  // Validate migration path exists
  if (fromVersion > toVersion) {
    const error = new Error(`Cannot migrate backwards from v${fromVersion} to v${toVersion}`)
    return handleMigrationError(result, error, ctx)
  }

  let currentData = data
  let currentVersion = fromVersion

  // Run migrations in sequence
  for (let version = fromVersion; version < toVersion; version++) {
    const migration = migrations[version]
    
    if (!migration) {
      const error = new Error(`Missing migration from v${version} to v${version + 1}`)
      return handleMigrationError(result, error, ctx)
    }

    try {
      // Run migration
      const migratedData = migration.migrate(currentData)
      
      // Validate if schema provided
      if (migration.validateWith) {
        const validation = migration.validateWith.safeParse(migratedData)
        if (!validation.success) {
          const error = new Error(`Migration v${version} validation failed: ${validation.error.message}`)
          return handleMigrationError(result, error, ctx, version, migratedData)
        }
        currentData = validation.data
      } else {
        currentData = migratedData
      }

      // Track successful migration
      result.migrationsApplied.push(version)
      result.version = version + 1
      
      // Log migration
      if (ctx.dryRun) {
        result.warnings.push(`[DRY RUN] Would apply migration v${version}: ${migration.description || 'No description'}`)
      } else {
        result.warnings.push(`Applied migration v${version}: ${migration.description || 'No description'}`)
      }

    } catch (error) {
      return handleMigrationError(result, error as Error, ctx, version, currentData)
    }
  }

  result.data = currentData
  return result
}

/**
 * Handle migration errors based on error strategy
 */
function handleMigrationError<T>(
  result: MigrationResult<T>,
  error: Error,
  context: MigrationContext,
  version?: number,
  data?: T
): MigrationResult<T> {
  const migrationError: MigrationError = {
    version: version ?? context.currentVersion,
    error,
    data,
    step: version ? `migration-v${version}` : 'validation'
  }

  result.errors.push(migrationError)

  switch (context.errorStrategy) {
    case 'throw':
      throw new Error(`Migration failed: ${error.message}`)
    
    case 'fallback':
      result.success = false
      result.warnings.push(`Migration failed, using fallback data: ${error.message}`)
      break
    
    case 'dry-run':
      result.success = false
      result.warnings.push(`[DRY RUN] Migration would fail: ${error.message}`)
      break
    
    case 'warn':
    default:
      result.success = false
      result.warnings.push(`Migration warning: ${error.message}`)
      break
  }

  return result
}

/**
 * Create versioned data wrapper
 */
export function createVersionedData<T>(data: T, version: number): VersionedData<T> {
  return {
    _meta: {
      version,
      migratedAt: new Date()
    },
    data
  }
}

/**
 * Extract data from versioned wrapper
 */
export function extractData<T>(versionedData: VersionedData<T>): T {
  return versionedData.data
}

/**
 * Get version from versioned data
 */
export function getVersion(versionedData: VersionedData<any>): number {
  return versionedData._meta.version
}

/**
 * Check if data needs migration
 */
export function needsMigration<T>(
  versionedData: VersionedData<T> | null,
  targetVersion: number
): boolean {
  if (!versionedData) return false
  return versionedData._meta.version < targetVersion
}

/**
 * Validate migration table completeness
 */
export function validateMigrationTable<T>(
  migrations: MigrationTable<T>,
  targetVersion: number
): { valid: boolean; missing: number[] } {
  const missing: number[] = []
  
  // Check for migrations from version 1 to targetVersion
  // Version 0 represents initial state, so no migration needed
  for (let version = 1; version < targetVersion; version++) {
    if (!migrations[version]) {
      missing.push(version)
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Create migration context for testing
 */
export function createMigrationContext(
  collectionName: string,
  fromVersion: number,
  toVersion: number,
  options?: Partial<MigrationContext>
): MigrationContext {
  return {
    collectionName,
    currentVersion: fromVersion,
    targetVersion: toVersion,
    dryRun: false,
    errorStrategy: 'warn',
    ...options
  }
} 