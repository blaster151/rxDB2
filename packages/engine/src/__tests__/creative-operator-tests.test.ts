import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from '../reactive'
import { 
  retry, 
  catchError, 
  startWith, 
  scan,
  combineLatest,
  withLatestFrom,
  switchMap,
  mergeMap,
  concatMap,
  tap,
  delay,
  sample,
  takeWhile,
  pairwise,
  zip
} from '../operators'

describe('Creative Operator Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Advanced Retry Patterns', () => {
    it('should implement exponential backoff retry strategy', () => {
      let attemptCount = 0
      const source = reactive(0)
      
      const exponentialBackoffSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            attemptCount++
            const delay = Math.pow(2, attemptCount - 1) * 100 // 100ms, 200ms, 400ms...
            setTimeout(() => {
              if (attemptCount <= 3) {
                throw new Error(`Attempt ${attemptCount} failed`)
              }
              callback(value)
            }, delay)
          })
        }
      }

      const retryStream = retry(exponentialBackoffSource, 3)
      const results: number[] = []
      const unsub = retryStream.subscribe((value) => results.push(value))

      source.set(42)
      
      // Advance through exponential backoff delays
      vi.advanceTimersByTime(100) // First retry
      vi.advanceTimersByTime(200) // Second retry  
      vi.advanceTimersByTime(400) // Third retry
      vi.advanceTimersByTime(100) // Success

      expect(attemptCount).toBe(4)
      expect(results).toEqual([42])

      unsub()
    })

    it('should handle retry with different error types', () => {
      const source = reactive(0)
      let attemptCount = 0
      
      const multiErrorSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            attemptCount++
            switch (attemptCount) {
              case 1:
                throw new TypeError('Type error')
              case 2:
                throw new RangeError('Range error')
              case 3:
                throw new ReferenceError('Reference error')
              default:
                callback(value)
            }
          })
        }
      }

      const retryStream = retry(multiErrorSource, 3)
      const results: number[] = []
      const unsub = retryStream.subscribe((value) => results.push(value))

      source.set(99)
      
      expect(attemptCount).toBe(4)
      expect(results).toEqual([99])

      unsub()
    })

    it('should implement circuit breaker pattern with retry', () => {
      const source = reactive(0)
      let failureCount = 0
      let circuitOpen = false
      
      const circuitBreakerSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            if (circuitOpen) {
              throw new Error('Circuit breaker open')
            }
            
            failureCount++
            if (failureCount <= 2) {
              throw new Error('Service unavailable')
            }
            
            // After 2 failures, open circuit
            if (failureCount === 3) {
              circuitOpen = true
              setTimeout(() => {
                circuitOpen = false // Reset after delay
              }, 1000)
              throw new Error('Circuit breaker opened')
            }
            
            callback(value)
          })
        }
      }

      const retryStream = retry(circuitBreakerSource, 5)
      const results: number[] = []
      const unsub = retryStream.subscribe((value) => results.push(value))

      source.set(123)
      
      // Wait for circuit breaker to reset
      vi.advanceTimersByTime(1100)
      
      expect(results).toEqual([123])

      unsub()
    })
  })

  describe('Advanced Error Recovery Patterns', () => {
    it('should implement fallback chain with catchError', () => {
      const primary = reactive(0)
      const secondary = reactive(0)
      const tertiary = reactive('tertiary')
      
      let primaryFailures = 0
      let secondaryFailures = 0
      
      const primarySource = {
        ...primary,
        subscribe(callback: (value: number) => void) {
          return primary.subscribe((value) => {
            primaryFailures++
            if (primaryFailures <= 2) {
              throw new Error('Primary failed')
            }
            callback(value)
          })
        }
      }
      
      const secondarySource = {
        ...secondary,
        subscribe(callback: (value: number) => void) {
          return secondary.subscribe((value) => {
            secondaryFailures++
            if (secondaryFailures <= 1) {
              throw new Error('Secondary failed')
            }
            callback(value)
          })
        }
      }

      // Fallback chain: primary -> secondary -> tertiary
      const resilientStream = catchError(
        primarySource,
        (error) => catchError(secondarySource, (error) => tertiary)
      )
      
      const results: (number | string)[] = []
      const unsub = resilientStream.subscribe((value) => results.push(value))

      primary.set(1)
      secondary.set(2)
      tertiary.set('final fallback')

      expect(results).toEqual(['tertiary', 'final fallback'])

      unsub()
    })

    it('should implement error classification and recovery', () => {
      const source = reactive(0)
      
      const classifiedErrorSource = {
        ...source,
        subscribe(callback: (value: number) => void) {
          return source.subscribe((value) => {
            if (value === 1) {
              throw new Error('NETWORK_ERROR')
            } else if (value === 2) {
              throw new Error('AUTH_ERROR')
            } else if (value === 3) {
              throw new Error('VALIDATION_ERROR')
            }
            callback(value)
          })
        }
      }

      const networkFallback = reactive('network_fallback')
      const authFallback = reactive('auth_fallback')
      const defaultFallback = reactive('default_fallback')

      const smartRecovery = catchError(classifiedErrorSource, (error) => {
        if (error.message === 'NETWORK_ERROR') {
          return networkFallback
        } else if (error.message === 'AUTH_ERROR') {
          return authFallback
        } else {
          return defaultFallback
        }
      })

      const results: (number | string)[] = []
      const unsub = smartRecovery.subscribe((value) => results.push(value))

      source.set(0) // Success
      source.set(1) // Network error
      source.set(2) // Auth error
      source.set(3) // Validation error
      source.set(4) // Success

      expect(results).toEqual([0, 'network_fallback', 'auth_fallback', 'default_fallback', 4])

      unsub()
    })
  })

  describe('Advanced Scan Patterns', () => {
    it('should implement state machine with scan', () => {
      type State = 'idle' | 'loading' | 'success' | 'error'
      type Action = { type: 'START' } | { type: 'SUCCEED' } | { type: 'FAIL' } | { type: 'RESET' }
      
      const actions = reactive<Action>({ type: 'RESET' })
      
      const stateMachine = scan(actions, (state: State, action: Action): State => {
        switch (action.type) {
          case 'START':
            return 'loading'
          case 'SUCCEED':
            return 'success'
          case 'FAIL':
            return 'error'
          case 'RESET':
            return 'idle'
          default:
            return state
        }
      }, 'idle' as State)

      const states: State[] = []
      const unsub = stateMachine.subscribe((state) => states.push(state))

      actions.set({ type: 'START' })
      actions.set({ type: 'SUCCEED' })
      actions.set({ type: 'RESET' })
      actions.set({ type: 'START' })
      actions.set({ type: 'FAIL' })

      expect(states).toEqual(['idle', 'loading', 'success', 'idle', 'loading', 'error'])

      unsub()
    })

    it('should implement undo/redo system with scan', () => {
      type HistoryItem = { value: number; timestamp: number }
      type HistoryAction = { type: 'ADD'; value: number } | { type: 'UNDO' } | { type: 'REDO' }
      
      const actions = reactive<HistoryAction>({ type: 'ADD', value: 0 })
      const history: HistoryItem[] = []
      const redoStack: HistoryItem[] = []
      
      const undoRedoSystem = scan(actions, (current: number, action: HistoryAction): number => {
        switch (action.type) {
          case 'ADD':
            history.push({ value: current, timestamp: Date.now() })
            redoStack.length = 0 // Clear redo stack on new action
            return action.value
          case 'UNDO':
            if (history.length > 0) {
              const lastItem = history.pop()!
              redoStack.push({ value: current, timestamp: Date.now() })
              return lastItem.value
            }
            return current
          case 'REDO':
            if (redoStack.length > 0) {
              const redoItem = redoStack.pop()!
              history.push({ value: current, timestamp: Date.now() })
              return redoItem.value
            }
            return current
          default:
            return current
        }
      }, 0)

      const values: number[] = []
      const unsub = undoRedoSystem.subscribe((value) => values.push(value))

      actions.set({ type: 'ADD', value: 1 })
      actions.set({ type: 'ADD', value: 2 })
      actions.set({ type: 'ADD', value: 3 })
      actions.set({ type: 'UNDO' })
      actions.set({ type: 'UNDO' })
      actions.set({ type: 'REDO' })
      actions.set({ type: 'ADD', value: 4 })

      expect(values).toEqual([0, 1, 2, 3, 2, 1, 2, 4])

      unsub()
    })

    it('should implement moving average with scan', () => {
      const values = reactive(0)
      const windowSize = 3
      
      const movingAverage = scan(values, (acc: number[], value: number): number[] => {
        acc.push(value)
        if (acc.length > windowSize) {
          acc.shift()
        }
        return acc
      }, [] as number[]).map((window) => {
        if (window.length === 0) return 0
        return window.reduce((sum, val) => sum + val, 0) / window.length
      })

      const averages: number[] = []
      const unsub = movingAverage.subscribe((avg) => averages.push(avg))

      values.set(1) // [1] -> 1
      values.set(2) // [1,2] -> 1.5
      values.set(3) // [1,2,3] -> 2
      values.set(4) // [2,3,4] -> 3
      values.set(5) // [3,4,5] -> 4

      expect(averages).toEqual([1, 1.5, 2, 3, 4])

      unsub()
    })
  })

  describe('Advanced Combination Patterns', () => {
    it('should implement form validation with combineLatest', () => {
      const username = reactive('')
      const email = reactive('')
      const password = reactive('')
      
      const usernameValid = username.map((val) => val.length >= 3)
      const emailValid = email.map((val) => val.includes('@'))
      const passwordValid = password.map((val) => val.length >= 8)
      
      const formValid = combineLatest(usernameValid, emailValid, passwordValid)
        .map(([user, email, pass]) => user && email && pass)
      
      const validationResults: boolean[] = []
      const unsub = formValid.subscribe((valid) => validationResults.push(valid))

      username.set('john')
      email.set('john@example.com')
      password.set('password123')

      expect(validationResults).toEqual([false, false, false, true])

      unsub()
    })

    it('should implement real-time collaboration with withLatestFrom', () => {
      const userTyping = reactive('')
      const userPresence = reactive('offline')
      const serverState = reactive('initial')
      
      const collaborativeEdit = withLatestFrom(userTyping, userPresence)
        .map(([typing, presence]) => ({
          content: typing,
          status: presence,
          timestamp: Date.now()
        }))
      
      const edits: any[] = []
      const unsub = collaborativeEdit.subscribe((edit) => edits.push(edit))

      userPresence.set('online')
      userTyping.set('Hello')
      userTyping.set('Hello world')
      userPresence.set('away')

      expect(edits.length).toBeGreaterThan(0)
      expect(edits[0].status).toBe('online')

      unsub()
    })
  })

  describe('Advanced Mapping Patterns', () => {
    it('should implement search with debouncing using switchMap', () => {
      const searchQuery = reactive('')
      let searchCallCount = 0
      
      const performSearch = (query: string) => {
        searchCallCount++
        const results = reactive([] as string[])
        
        // Simulate API delay
        setTimeout(() => {
          const mockResults = [`Result 1 for ${query}`, `Result 2 for ${query}`]
          results.set(mockResults)
        }, 100)
        
        return results
      }
      
      const searchResults = switchMap(searchQuery, performSearch)
      
      const allResults: string[][] = []
      const unsub = searchResults.subscribe((results) => allResults.push(results))

      searchQuery.set('react')
      vi.advanceTimersByTime(50) // Cancel previous search
      searchQuery.set('react hooks')
      vi.advanceTimersByTime(50) // Cancel previous search
      searchQuery.set('react hooks tutorial')
      vi.advanceTimersByTime(150) // Let this search complete

      expect(searchCallCount).toBe(3)
      expect(allResults.length).toBeGreaterThan(0)

      unsub()
    })

    it('should implement file upload with progress using mergeMap', () => {
      const fileUploads = reactive<File[]>([])
      
      const uploadFile = (file: File) => {
        const progress = reactive(0)
        
        // Simulate upload progress
        const interval = setInterval(() => {
          const current = progress.get()
          if (current < 100) {
            progress.set(current + 10)
          } else {
            clearInterval(interval)
          }
        }, 50)
        
        return progress
      }
      
      const uploadProgress = mergeMap(fileUploads, uploadFile)
      
      const allProgress: number[] = []
      const unsub = uploadProgress.subscribe((progress) => allProgress.push(progress))

      // Simulate multiple file uploads
      fileUploads.set([{ name: 'file1.txt' } as File])
      fileUploads.set([{ name: 'file2.txt' } as File])
      
      vi.advanceTimersByTime(500) // Let uploads progress

      expect(allProgress.length).toBeGreaterThan(0)

      unsub()
    })

    it('should implement sequential API calls with concatMap', () => {
      const userIds = reactive<number[]>([])
      
      const fetchUserDetails = (userId: number) => {
        const userData = reactive({} as any)
        
        setTimeout(() => {
          userData.set({ id: userId, name: `User ${userId}`, email: `user${userId}@example.com` })
        }, 100)
        
        return userData
      }
      
      const userDetails = concatMap(userIds, fetchUserDetails)
      
      const allUsers: any[] = []
      const unsub = userDetails.subscribe((users) => allUsers.push(...users))

      userIds.set([1, 2, 3])
      
      vi.advanceTimersByTime(400) // Let all sequential calls complete

      expect(allUsers.length).toBe(3)

      unsub()
    })
  })

  describe('Advanced Side Effect Patterns', () => {
    it('should implement analytics tracking with tap', () => {
      const userActions = reactive('')
      const analytics: any[] = []
      
      const trackEvent = (action: string) => {
        analytics.push({
          event: action,
          timestamp: Date.now(),
          sessionId: 'session-123'
        })
      }
      
      const trackedActions = tap(userActions, trackEvent)
      
      const actions: string[] = []
      const unsub = trackedActions.subscribe((action) => actions.push(action))

      userActions.set('page_view')
      userActions.set('button_click')
      userActions.set('form_submit')

      expect(actions).toEqual(['page_view', 'button_click', 'form_submit'])
      expect(analytics.length).toBe(3)
      expect(analytics[0].event).toBe('page_view')

      unsub()
    })

    it('should implement performance monitoring with tap', () => {
      const operations = reactive('')
      const performanceMetrics: any[] = []
      
      const measurePerformance = (operation: string) => {
        const startTime = performance.now()
        return () => {
          const duration = performance.now() - startTime
          performanceMetrics.push({
            operation,
            duration,
            timestamp: Date.now()
          })
        }
      }
      
      const monitoredOperations = tap(operations, (operation) => {
        const cleanup = measurePerformance(operation)
        setTimeout(cleanup, 0)
      })
      
      const unsub = monitoredOperations.subscribe(() => {})
      
      operations.set('database_query')
      operations.set('api_call')
      operations.set('file_upload')
      
      vi.advanceTimersByTime(10)
      
      expect(performanceMetrics.length).toBe(3)

      unsub()
    })
  })

  describe('Advanced Timing Patterns', () => {
    it('should implement rate limiting with delay and sample', () => {
      const rapidEvents = reactive(0)
      
      const rateLimited = sample(rapidEvents, delay(rapidEvents, 100))
      
      const events: number[] = []
      const unsub = rateLimited.subscribe((event) => events.push(event))

      // Rapid fire events
      for (let i = 1; i <= 10; i++) {
        rapidEvents.set(i)
      }
      
      vi.advanceTimersByTime(500)

      expect(events.length).toBeLessThan(10) // Should be rate limited

      unsub()
    })

    it('should implement timeout pattern with takeWhile', () => {
      const longRunningTask = reactive(0)
      const startTime = Date.now()
      
      const timeoutTask = takeWhile(longRunningTask, (value) => {
        return Date.now() - startTime < 1000 // 1 second timeout
      })
      
      const results: number[] = []
      const unsub = timeoutTask.subscribe((value) => results.push(value))

      // Simulate long-running task
      for (let i = 1; i <= 20; i++) {
        longRunningTask.set(i)
        vi.advanceTimersByTime(100) // Each step takes 100ms
      }

      expect(results.length).toBeLessThan(20) // Should timeout

      unsub()
    })
  })

  describe('Advanced Data Flow Patterns', () => {
    it('should implement data pipeline with multiple operators', () => {
      const rawData = reactive(0)
      
      const processedData = rawData
        .map((x) => x * 2)
        .filter((x) => x > 0)
        .map((x) => `Value: ${x}`)
      
      const loggedData = tap(processedData, (value) => {
        console.log('Processing:', value)
      })
      
      const finalData = startWith(loggedData, 'Initial')
      
      const results: string[] = []
      const unsub = finalData.subscribe((value) => results.push(value))

      rawData.set(1)
      rawData.set(2)
      rawData.set(3)

      expect(results).toEqual(['Initial', 'Value: 2', 'Value: 4', 'Value: 6'])

      unsub()
    })

    it('should implement error recovery pipeline', () => {
      const source = reactive(0)
      
      const resilientPipeline = source
        .map((x) => {
          if (x === 2) throw new Error('Processing error')
          return x * 2
        })
        .pipe(catchError, (error) => reactive(['error', error.message]))
        .pipe(retry, 2)
        .pipe(tap, (value) => console.log('Recovered:', value))
      
      const results: (number | string)[] = []
      const unsub = resilientPipeline.subscribe((value) => results.push(value))

      source.set(1) // Success
      source.set(2) // Error, retry, then fallback
      source.set(3) // Success

      expect(results.length).toBeGreaterThan(0)

      unsub()
    })
  })
}) 