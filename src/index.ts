// rxDB2 Public API Surface
// This file defines the official, stable public API for the library
// All exports are tree-shakable, ESM-compatible, and type-safe
// 
// This barrel file merges all named chunks into a single public API surface

// ============================================================================
// REACTIVE PRIMITIVES & CREATION UTILITIES
// ============================================================================

export * from './chunks/reactive.js'

// ============================================================================
// CORE REACTIVE OPERATORS
// ============================================================================

export * from './chunks/coreOperators.js'

// ============================================================================
// COLLECTION MANAGEMENT
// ============================================================================

export * from './chunks/collections.js'

// ============================================================================
// STORAGE ADAPTERS
// ============================================================================

export * from './chunks/storage.js'

// ============================================================================
// SCHEMA & VALIDATION
// ============================================================================

export * from './chunks/validation.js'

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

export * from './chunks/plugins.js'

// Note: Plugin implementations are exported via subpath exports:
// import { useCollection } from 'rxdb2/plugins/react-hooks'
// import { devtools } from 'rxdb2/plugins/vite-devtools' 