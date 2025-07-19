import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDiagnostics, trackSubscriber, trackOperator, trackLiveQuery, recordOperation, diagnosticsRegistry } from '../devtools/diagnostics.js'
import { defineCollection } from '../database/defineCollection.js'
import { reactive } from '../reactive.js'
import { map, filter } from '../operators.js'
import { z } from 'zod'

// Mock timers for consistent testing
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DevTools Diagnostics', () => {
  describe('Basic Tracking', () => {
    it('should track subscribers', () => {
      trackSubscriber('test-sub', 'custom', 'test-source', { test: 'data' })
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      const subscriber = snapshot.subscribers.find(s => s.id === 'test-sub')
      
      expect(subscriber).toBeDefined()
      expect(subscriber!.type).toBe('custom')
      expect(subscriber!.source).toBe('test-source')
      expect(subscriber!.active).toBe(true)
      expect(subscriber!.metadata).toEqual({ test: 'data' })
    })

    it('should track operators', () => {
      trackOperator('test-op', 'map', 'test-source', { transform: 'uppercase' })
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      const operator = snapshot.operators.find(o => o.id === 'test-op')
      
      expect(operator).toBeDefined()
      expect(operator!.type).toBe('map')
      expect(operator!.source).toBe('test-source')
      expect(operator!.active).toBe(true)
      expect(operator!.inputCount).toBe(0)
      expect(operator!.outputCount).toBe(0)
      expect(operator!.errorCount).toBe(0)
    })

    it('should track live queries', () => {
      trackLiveQuery('test-query', 'users', 'age > 18')
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      const query = snapshot.liveQueries.find(q => q.id === 'test-query')
      
      expect(query).toBeDefined()
      expect(query!.collection).toBe('users')
      expect(query!.filter).toBe('age > 18')
      expect(query!.active).toBe(true)
      expect(query!.resultCount).toBe(0)
    })

    it('should record operations', () => {
      recordOperation(100, false) // 100ms, no error
      recordOperation(50, true)   // 50ms, with error
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      
      expect(snapshot.system.performance.totalOperations).toBe(2)
      expect(snapshot.system.performance.errorRate).toBe(0.5)
      expect(snapshot.system.performance.averageQueryTime).toBe(75)
    })
  })

  describe('Activity Updates', () => {
    it('should update subscriber activity', () => {
      trackSubscriber('active-sub', 'custom', 'test')
      
      const before = diagnosticsRegistry.generateSnapshot()
      const subscriber = before.subscribers.find(s => s.id === 'active-sub')
      const beforeTime = subscriber!.lastActivity!.getTime()
      
      // Advance time
      vi.advanceTimersByTime(1000)
      
      // Update activity
      diagnosticsRegistry.updateSubscriberActivity('active-sub')
      
      const after = diagnosticsRegistry.generateSnapshot()
      const updatedSubscriber = after.subscribers.find(s => s.id === 'active-sub')
      const afterTime = updatedSubscriber!.lastActivity!.getTime()
      
      expect(afterTime).toBeGreaterThan(beforeTime)
    })

    it('should update operator metrics', () => {
      trackOperator('metrics-op', 'map', 'test')
      
      diagnosticsRegistry.updateOperatorActivity('metrics-op', 10, 8, 2)
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      const operator = snapshot.operators.find(o => o.id === 'metrics-op')
      
      expect(operator!.inputCount).toBe(10)
      expect(operator!.outputCount).toBe(8)
      expect(operator!.errorCount).toBe(2)
    })

    it('should update live query activity', () => {
      trackLiveQuery('active-query', 'users', 'active = true')
      
      diagnosticsRegistry.updateLiveQueryActivity('active-query', 5, 25)
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      const query = snapshot.liveQueries.find(q => q.id === 'active-query')
      
      expect(query!.resultCount).toBe(5)
      expect(query!.executionTime).toBe(25)
    })
  })

  describe('Unregistration', () => {
    it('should mark subscribers as inactive when unregistered', () => {
      trackSubscriber('unsub-test', 'custom', 'test')
      
      // Verify active
      let snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.subscribers.find(s => s.id === 'unsub-test')!.active).toBe(true)
      
      // Unregister
      diagnosticsRegistry.unregisterSubscriber('unsub-test')
      
      // Verify inactive
      snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.subscribers.find(s => s.id === 'unsub-test')!.active).toBe(false)
    })

    it('should mark operators as inactive when unregistered', () => {
      trackOperator('unreg-op', 'filter', 'test')
      
      // Verify active
      let snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.operators.find(o => o.id === 'unreg-op')!.active).toBe(true)
      
      // Unregister
      diagnosticsRegistry.unregisterOperator('unreg-op')
      
      // Verify inactive
      snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.operators.find(o => o.id === 'unreg-op')!.active).toBe(false)
    })

    it('should mark live queries as inactive when unregistered', () => {
      trackLiveQuery('unreg-query', 'users', 'test')
      
      // Verify active
      let snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.liveQueries.find(q => q.id === 'unreg-query')!.active).toBe(true)
      
      // Unregister
      diagnosticsRegistry.unregisterLiveQuery('unreg-query')
      
      // Verify inactive
      snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.liveQueries.find(q => q.id === 'unreg-query')!.active).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup inactive entries older than threshold', () => {
      // Create some entries
      trackSubscriber('old-sub', 'custom', 'test')
      trackOperator('old-op', 'map', 'test')
      trackLiveQuery('old-query', 'users', 'test')
      
      // Mark them as inactive
      diagnosticsRegistry.unregisterSubscriber('old-sub')
      diagnosticsRegistry.unregisterOperator('old-op')
      diagnosticsRegistry.unregisterLiveQuery('old-query')
      
      // Advance time beyond cleanup threshold (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000)
      
      // Run cleanup
      diagnosticsRegistry.cleanup(5 * 60 * 1000)
      
      // Verify they're gone
      const snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.subscribers.find(s => s.id === 'old-sub')).toBeUndefined()
      expect(snapshot.operators.find(o => o.id === 'old-op')).toBeUndefined()
      expect(snapshot.liveQueries.find(q => q.id === 'old-query')).toBeUndefined()
    })

    it('should keep active entries during cleanup', () => {
      // Create active and inactive entries
      trackSubscriber('active-sub', 'custom', 'test')
      trackSubscriber('inactive-sub', 'custom', 'test')
      
      diagnosticsRegistry.unregisterSubscriber('inactive-sub')
      
      // Advance time
      vi.advanceTimersByTime(6 * 60 * 1000)
      
      // Run cleanup
      diagnosticsRegistry.cleanup(5 * 60 * 1000)
      
      // Verify active entry remains
      const snapshot = diagnosticsRegistry.generateSnapshot()
      expect(snapshot.subscribers.find(s => s.id === 'active-sub')).toBeDefined()
      expect(snapshot.subscribers.find(s => s.id === 'inactive-sub')).toBeUndefined()
    })
  })

  describe('System Diagnostics', () => {
    it('should generate accurate system metrics', () => {
      // Create some test data
      trackSubscriber('sub1', 'custom', 'test1')
      trackSubscriber('sub2', 'custom', 'test2')
      trackOperator('op1', 'map', 'test1')
      trackLiveQuery('query1', 'users', 'test1')
      
      recordOperation(100, false)
      recordOperation(200, true)
      recordOperation(150, false)
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      
      // Memory metrics
      expect(snapshot.system.memory.subscribers).toBe(2)
      expect(snapshot.system.memory.operators).toBe(1)
      expect(snapshot.system.memory.liveQueries).toBe(1)
      
      // Performance metrics
      expect(snapshot.system.performance.totalOperations).toBe(3)
      expect(snapshot.system.performance.errorRate).toBeCloseTo(0.333, 2)
      expect(snapshot.system.performance.averageQueryTime).toBe(150)
      
      // Uptime metrics
      expect(snapshot.system.uptime.startTime).toBeInstanceOf(Date)
      expect(snapshot.system.uptime.currentTime).toBeInstanceOf(Date)
      expect(snapshot.system.uptime.duration).toBeGreaterThan(0)
    })
  })

  describe('Diagnostics Stream', () => {
    it('should emit snapshots periodically', () => {
      const diagnostics = getDiagnostics()
      const snapshots: any[] = []
      
      const unsubscribe = diagnostics.subscribe(snapshot => {
        snapshots.push(snapshot)
      })
      
      // Initial snapshot
      expect(snapshots.length).toBe(1)
      
      // Advance time to trigger periodic updates
      vi.advanceTimersByTime(1000)
      
      // Should have received another snapshot
      expect(snapshots.length).toBe(2)
      
      // Add some activity
      trackSubscriber('stream-test', 'custom', 'test')
      
      vi.advanceTimersByTime(1000)
      
      // Should reflect new activity
      expect(snapshots.length).toBe(3)
      expect(snapshots[2].subscribers.length).toBeGreaterThan(snapshots[1].subscribers.length)
      
      unsubscribe()
    })

    it('should stop emitting when no subscribers', () => {
      const diagnostics = getDiagnostics()
      const snapshots: any[] = []
      
      const unsubscribe = diagnostics.subscribe(snapshot => {
        snapshots.push(snapshot)
      })
      
      // Initial snapshot
      expect(snapshots.length).toBe(1)
      
      // Unsubscribe
      unsubscribe()
      
      // Advance time
      vi.advanceTimersByTime(2000)
      
      // Should not have received more snapshots
      expect(snapshots.length).toBe(1)
    })
  })

  describe('Integration with Collections', () => {
    it('should track collection operations', () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string()
      })
      
      const users = defineCollection('users', UserSchema)
      
      // Add some users
      users.insert({ id: '1', name: 'Alice', email: 'alice@test.com' })
      users.insert({ id: '2', name: 'Bob', email: 'bob@test.com' })
      
      // Record operations
      recordOperation(50, false)
      recordOperation(75, false)
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      
      expect(snapshot.system.performance.totalOperations).toBe(2)
      expect(snapshot.system.performance.averageQueryTime).toBe(62.5)
    })
  })

  describe('Integration with Reactive System', () => {
    it('should track reactive subscribers', () => {
      const data = reactive([1, 2, 3, 4, 5])
      
      // Create some operators
      const doubled = map(data, x => x * 2)
      const evens = filter(doubled, x => x % 2 === 0)
      
      // Track them
      trackOperator('double-op', 'map', 'data → doubled')
      trackOperator('even-op', 'filter', 'doubled → evens')
      
      const snapshot = diagnosticsRegistry.generateSnapshot()
      
      expect(snapshot.operators.find(o => o.id === 'double-op')).toBeDefined()
      expect(snapshot.operators.find(o => o.id === 'even-op')).toBeDefined()
    })
  })
}) 