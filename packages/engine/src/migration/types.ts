import type { ZodSchema } from 'zod'

// Version metadata structure
export interface VersionMetadata {
  version: number
  migratedAt?: Date
  migrationPath?: number[] // Track which migrations were applied
}

// Wrapped data with version metadata
export interface VersionedData<T = any> {
  _meta: VersionMetadata
  data: T
}

// Migration function type
export type MigrationFunction<T = any> = (data: T) => T

// Migration step with optional validation
export interface MigrationStep<T = any> {
  migrate: MigrationFunction<T>
  validateWith?: ZodSchema<T>
  description?: string
  requiresPersistence?: boolean // Override default persistence behavior
}

// Migration table
export type MigrationTable<T = any> = Record<number, MigrationStep<T>>

// Error handling strategies
export type MigrationErrorStrategy = 'warn' | 'throw' | 'fallback' | 'dry-run'

// Migration configuration
export interface MigrationConfig<T = any> {
  schemaVersion: number
  migrations: MigrationTable<T>
  onMigrationError?: MigrationErrorStrategy
  validateAfterMigration?: boolean
  dryRun?: boolean
}

// Migration result
export interface MigrationResult<T = any> {
  success: boolean
  data?: T
  version: number
  migrationsApplied: number[]
  errors: MigrationError[]
  warnings: string[]
}

// Migration error
export interface MigrationError {
  version: number
  error: Error
  data?: any
  step?: string
}

// Migration context for advanced scenarios
export interface MigrationContext {
  collectionName: string
  currentVersion: number
  targetVersion: number
  dryRun: boolean
  errorStrategy: MigrationErrorStrategy
}

// Storage adapter interface for versioned data
export interface VersionedStorageAdapter {
  get<T>(key: string): Promise<VersionedData<T> | null>
  set<T>(key: string, data: VersionedData<T>): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
}

// Migration utilities
export interface MigrationUtils {
  runMigrations<T>(
    data: T,
    fromVersion: number,
    toVersion: number,
    migrations: MigrationTable<T>,
    context?: Partial<MigrationContext>
  ): Promise<MigrationResult<T>>
  
  validateMigration<T>(
    data: T,
    schema: ZodSchema<T>,
    version: number
  ): Promise<{ valid: boolean; errors?: any[] }>
  
  createVersionedData<T>(data: T, version: number): VersionedData<T>
  
  extractData<T>(versionedData: VersionedData<T>): T
  
  getVersion(versionedData: VersionedData<any>): number
} 