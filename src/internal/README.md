# Internal APIs - NOT FOR PUBLIC USE

This directory contains internal implementation details that are **NOT part of the public API**.

## 🚫 Private APIs

These modules are intentionally not exported from the main index and should not be used by consumers:

- **Internal state management**: Implementation details of reactive streams
- **Debug utilities**: Development-only tools and helpers
- **Experimental features**: APIs that are still in development
- **Performance optimizations**: Internal caching and optimization logic

## 🔒 Why Internal?

- **API Stability**: Public APIs follow semantic versioning, internals can change freely
- **Tree-shaking**: Only public exports are included in consumer bundles
- **Encapsulation**: Implementation details are hidden from consumers
- **Maintainability**: Internal changes don't break consumer code

## 📁 Structure

```
src/internal/
├── state/           # Internal state management
├── debug/           # Debug utilities (dev only)
├── cache/           # Internal caching logic
├── utils/           # Internal helper functions
└── experimental/    # Experimental features
```

## ⚠️ Important Notes

- **DO NOT** import from `src/internal/` in consumer code
- **DO NOT** export internal modules from public APIs
- **DO** use JSDoc `@internal` tags for internal types
- **DO** test internal APIs separately from public APIs

## 🧪 Testing

Internal APIs can be tested directly, but public API tests should only use exported modules:

```typescript
// ✅ Good - testing public API
import { defineCollection } from 'rxdb2'

// ❌ Bad - testing internal APIs in public tests
import { internalStateManager } from 'rxdb2/internal/state'
```

## 🔄 Migration

When promoting internal APIs to public:

1. Move to appropriate public module
2. Add proper documentation
3. Update type exports
4. Add to public index.ts
5. Remove from internal directory
6. Update tests to use public API 