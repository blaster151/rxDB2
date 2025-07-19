import { reactive } from '../reactive.js'
import { createObservable } from '../createObservable.js'
import type { Observable } from '../createObservable.js'
import { getCollection, getCollectionState, CollectionState } from '../database/defineCollection.js'

// Diagnostic snapshot types
export interface CollectionDiagnostics {
  name: string
  state: CollectionState
  count: number
  schema: string
  lastActivity?: Date
  error?: string
}

export interface SubscriberDiagnostics {
  id: string
  type: 'collection' | 'operator' | 'liveQuery' | 'custom'
  source: string
  active: boolean
  createdAt: Date
  lastActivity?: Date
  metadata?: Record<string, any>
}

export interface OperatorDiagnostics {
  id: string
  type: 'map' | 'filter' | 'scan' | 'mergeMap' | 'switchMap' | 'concatMap' | 'share' | 'multicast' | 'custom'
  source: string
  active: boolean
  createdAt: Date
  lastActivity?: Date
  inputCount: number
  outputCount: number
  errorCount: number
  metadata?: Record<string, any>
}

export interface LiveQueryDiagnostics {
  id: string
  collection: string
  filter?: string
  active: boolean
  createdAt: Date
  lastActivity?: Date
  resultCount: number
  executionTime?: number
}

export interface SystemDiagnostics {
  memory: {
    collections: number
    subscribers: number
    operators: number
    liveQueries: number
  }
  performance: {
    averageQueryTime: number
    totalOperations: number
    errorRate: number
  }
  uptime: {
    startTime: Date
    currentTime: Date
    duration: number
  }
}

export interface DiagnosticsSnapshot {
  collections: CollectionDiagnostics[]
  subscribers: SubscriberDiagnostics[]
  operators: OperatorDiagnostics[]
  liveQueries: LiveQueryDiagnostics[]
  system: SystemDiagnostics
  timestamp: Date
}

// Global tracking registry
class DiagnosticsRegistry {
  private subscribers = new Map<string, SubscriberDiagnostics>()
  private operators = new Map<string, OperatorDiagnostics>()
  private liveQueries = new Map<string, LiveQueryDiagnostics>()
  private systemMetrics = {
    startTime: new Date(),
    totalOperations: 0,
    totalErrors: 0,
    queryTimes: [] as number[]
  }

  // Subscriber tracking
  registerSubscriber(id: string, type: SubscriberDiagnostics['type'], source: string, metadata?: Record<string, any>): void {
    this.subscribers.set(id, {
      id,
      type,
      source,
      active: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata
    })
  }

  unregisterSubscriber(id: string): void {
    const subscriber = this.subscribers.get(id)
    if (subscriber) {
      subscriber.active = false
      subscriber.lastActivity = new Date()
    }
  }

  updateSubscriberActivity(id: string): void {
    const subscriber = this.subscribers.get(id)
    if (subscriber) {
      subscriber.lastActivity = new Date()
    }
  }

  // Operator tracking
  registerOperator(id: string, type: OperatorDiagnostics['type'], source: string, metadata?: Record<string, any>): void {
    this.operators.set(id, {
      id,
      type,
      source,
      active: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      inputCount: 0,
      outputCount: 0,
      errorCount: 0,
      metadata
    })
  }

  unregisterOperator(id: string): void {
    const operator = this.operators.get(id)
    if (operator) {
      operator.active = false
      operator.lastActivity = new Date()
    }
  }

  updateOperatorActivity(id: string, inputCount?: number, outputCount?: number, errorCount?: number): void {
    const operator = this.operators.get(id)
    if (operator) {
      operator.lastActivity = new Date()
      if (inputCount !== undefined) operator.inputCount = inputCount
      if (outputCount !== undefined) operator.outputCount = outputCount
      if (errorCount !== undefined) operator.errorCount = errorCount
    }
  }

  // LiveQuery tracking
  registerLiveQuery(id: string, collection: string, filter?: string): void {
    this.liveQueries.set(id, {
      id,
      collection,
      filter,
      active: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      resultCount: 0
    })
  }

  unregisterLiveQuery(id: string): void {
    const query = this.liveQueries.get(id)
    if (query) {
      query.active = false
      query.lastActivity = new Date()
    }
  }

  updateLiveQueryActivity(id: string, resultCount?: number, executionTime?: number): void {
    const query = this.liveQueries.get(id)
    if (query) {
      query.lastActivity = new Date()
      if (resultCount !== undefined) query.resultCount = resultCount
      if (executionTime !== undefined) query.executionTime = executionTime
    }
  }

  // System metrics
  recordOperation(executionTime?: number, error?: boolean): void {
    this.systemMetrics.totalOperations++
    if (error) this.systemMetrics.totalErrors++
    if (executionTime !== undefined) {
      this.systemMetrics.queryTimes.push(executionTime)
      // Keep only last 100 measurements
      if (this.systemMetrics.queryTimes.length > 100) {
        this.systemMetrics.queryTimes.shift()
      }
    }
  }

  // Generate diagnostics snapshot
  generateSnapshot(): DiagnosticsSnapshot {
    const collections = this.getCollectionDiagnostics()
    const subscribers = Array.from(this.subscribers.values())
    const operators = Array.from(this.operators.values())
    const liveQueries = Array.from(this.liveQueries.values())
    const system = this.getSystemDiagnostics()

    return {
      collections,
      subscribers,
      operators,
      liveQueries,
      system,
      timestamp: new Date()
    }
  }

  private getCollectionDiagnostics(): CollectionDiagnostics[] {
    // This would need to be integrated with the actual collection registry
    // For now, we'll return a placeholder
    return []
  }

  private getSystemDiagnostics(): SystemDiagnostics {
    const averageQueryTime = this.systemMetrics.queryTimes.length > 0
      ? this.systemMetrics.queryTimes.reduce((a, b) => a + b, 0) / this.systemMetrics.queryTimes.length
      : 0

    const errorRate = this.systemMetrics.totalOperations > 0
      ? this.systemMetrics.totalErrors / this.systemMetrics.totalOperations
      : 0

    return {
      memory: {
        collections: this.getCollectionDiagnostics().length,
        subscribers: this.subscribers.size,
        operators: this.operators.size,
        liveQueries: this.liveQueries.size
      },
      performance: {
        averageQueryTime,
        totalOperations: this.systemMetrics.totalOperations,
        errorRate
      },
      uptime: {
        startTime: this.systemMetrics.startTime,
        currentTime: new Date(),
        duration: Date.now() - this.systemMetrics.startTime.getTime()
      }
    }
  }

  // Cleanup inactive entries
  cleanup(olderThanMs: number = 5 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs

    // Cleanup inactive subscribers
    for (const [id, subscriber] of this.subscribers.entries()) {
      if (!subscriber.active && subscriber.lastActivity!.getTime() < cutoff) {
        this.subscribers.delete(id)
      }
    }

    // Cleanup inactive operators
    for (const [id, operator] of this.operators.entries()) {
      if (!operator.active && operator.lastActivity!.getTime() < cutoff) {
        this.operators.delete(id)
      }
    }

    // Cleanup inactive live queries
    for (const [id, query] of this.liveQueries.entries()) {
      if (!query.active && query.lastActivity!.getTime() < cutoff) {
        this.liveQueries.delete(id)
      }
    }
  }
}

// Global registry instance
const diagnosticsRegistry = new DiagnosticsRegistry()

// Enhanced observable with diagnostics tracking
export function createDiagnosticObservable<T>(initialValue: T, id: string, type: 'subscriber' | 'operator', source: string, metadata?: Record<string, any>): Observable<T> {
  const base = createObservable(initialValue)
  const originalSubscribe = base.subscribe

  // Register with diagnostics
  if (type === 'subscriber') {
    diagnosticsRegistry.registerSubscriber(id, 'custom', source, metadata)
  } else {
    diagnosticsRegistry.registerOperator(id, 'custom', source, metadata)
  }

  // Enhanced subscribe with activity tracking
  const enhancedSubscribe = (callback: (value: T) => void) => {
    const unsub = originalSubscribe((value) => {
      // Update activity
      if (type === 'subscriber') {
        diagnosticsRegistry.updateSubscriberActivity(id)
      } else {
        diagnosticsRegistry.updateOperatorActivity(id)
      }
      callback(value)
    })

    return () => {
      unsub()
      // Unregister when subscription ends
      if (type === 'subscriber') {
        diagnosticsRegistry.unregisterSubscriber(id)
      } else {
        diagnosticsRegistry.unregisterOperator(id)
      }
    }
  }

  return {
    ...base,
    subscribe: enhancedSubscribe
  }
}

// Main diagnostics API
export function getDiagnostics(): Observable<DiagnosticsSnapshot> {
  const diagnosticsStream = reactive<DiagnosticsSnapshot>(diagnosticsRegistry.generateSnapshot())

  // Update diagnostics periodically
  const interval = setInterval(() => {
    diagnosticsRegistry.cleanup()
    diagnosticsStream.set(diagnosticsRegistry.generateSnapshot())
  }, 1000) // Update every second

  // Cleanup interval when no subscribers
  let subscriberCount = 0
  const originalSubscribe = diagnosticsStream.subscribe

  diagnosticsStream.subscribe = (callback) => {
    subscriberCount++
    const unsub = originalSubscribe(callback)
    
    return () => {
      unsub()
      subscriberCount--
      if (subscriberCount === 0) {
        clearInterval(interval)
      }
    }
  }

  return diagnosticsStream
}

// Utility functions for manual tracking
export function trackSubscriber(id: string, source: string, metadata?: Record<string, any>): void {
  diagnosticsRegistry.registerSubscriber(id, 'custom', source, metadata)
}

export function trackOperator(id: string, type: OperatorDiagnostics['type'], source: string, metadata?: Record<string, any>): void {
  diagnosticsRegistry.registerOperator(id, type, source, metadata)
}

export function trackLiveQuery(id: string, collection: string, filter?: string): void {
  diagnosticsRegistry.registerLiveQuery(id, collection, filter)
}

export function recordOperation(executionTime?: number, error?: boolean): void {
  diagnosticsRegistry.recordOperation(executionTime, error)
}

// Export registry for advanced usage
export { diagnosticsRegistry } 