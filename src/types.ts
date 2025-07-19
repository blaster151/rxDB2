// Public API Types for rxDB2
// These types are part of the stable public API surface

// ============================================================================
// PLUGIN SYSTEM TYPES
// ============================================================================

/**
 * Plugin interface for extending rxDB2 functionality
 */
export interface Plugin {
  name: string
  version: string
  install(context: PluginContext): void
  uninstall?(): void
}

/**
 * Context provided to plugins during installation
 */
export interface PluginContext {
  // Collection management
  defineCollection: <T>(name: string, schema: any) => any
  
  // Reactive system
  reactive: <T>(initial: T) => any
  createObservable: <T>(initial: T) => any
  
  // Storage
  createStorageAdapter: (options: any) => any
  
  // Utilities
  z: any // Zod instance
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Result of a successful operation
 */
export type SuccessResult<T> = {
  success: true
  data: T
}

/**
 * Result of a failed operation
 */
export type ErrorResult<E = string> = {
  success: false
  error: E
}

/**
 * Generic result type for operations that may fail
 */
export type Result<T, E = string> = SuccessResult<T> | ErrorResult<E>

// ============================================================================
// REACTIVE TYPES
// ============================================================================

/**
 * Subscription handle for reactive streams
 */
export interface Subscription {
  unsubscribe(): void
  readonly closed: boolean
}

/**
 * Observer interface for reactive streams
 */
export interface Observer<T> {
  next?(value: T): void
  error?(error: any): void
  complete?(): void
}

/**
 * Teardown function for cleanup
 */
export type Teardown = () => void

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * Query filter interface
 */
export interface QueryFilter<T> {
  [K in keyof T]?: T[K] | { $in?: T[K][] } | { $gt?: T[K] } | { $lt?: T[K] }
}

/**
 * Query options for advanced filtering
 */
export interface QueryOptions<T> {
  filter?: QueryFilter<T>
  sort?: { [K in keyof T]?: 1 | -1 }
  limit?: number
  offset?: number
}

/**
 * Live query result that updates automatically
 */
export interface LiveQuery<T> {
  subscribe(callback: (data: T[]) => void): Subscription
  get(): T[]
  unsubscribe(): void
} 