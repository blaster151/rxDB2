// Engine package exports - ESM compatible with tree-shaking support

// Database and collections
export { defineCollection } from './database/defineCollection.js'
export type { 
  Collection, 
  InsertResult, 
  UpdateResult, 
  DeleteResult, 
  QueryResult 
} from './database/defineCollection.js'

// Reactive system
export { reactive } from './reactive.js'
export type { Reactive } from './reactive.js'

// Observable creation
export { createObservable } from './createObservable.js'

// Event streams
export { fromEvent } from './fromEvent.js'

// WebSocket streams
export { fromWebSocket, sendWebSocketMessage, closeWebSocketConnection } from './fromWebSocket.js'

// Promise streams
export { fromPromise, fromAsync, fromPromiseWithError } from './fromPromise.js'

// Sharing operators
export { share } from './share.js'
export { multicast } from './multicast.js'

// Reactive operators
export * from './operators.js'

// Utility types
export type { LiveQuery } from './types.js' 