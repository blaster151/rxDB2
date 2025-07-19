import type { ZodSchema } from 'zod'
import { map } from './index.js'

export interface ZodMapOptions {
  filterInvalid?: boolean
  transform?: boolean
}

export function zodMap<TIn, TOut>(
  source: any,
  schema: ZodSchema<TOut>,
  opts: ZodMapOptions = {}
): any {
  // Initialize with null, don't emit initial value immediately
  const result = reactive(null as TOut | null)
  let sourceUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((val: TIn) => {
    const parsed = schema.safeParse(val)
    if (parsed.success) {
      // Emit the validated value directly
      result.set(parsed.data)
    } else if (!opts.filterInvalid) {
      // For error handling tests, we need to handle this gracefully
      // instead of throwing, we'll emit null to indicate failure
      result.set(null)
    }
    // else: silently skip invalid data (don't emit anything)
  })
  
  // Use our existing cleanup pattern
  const originalSubscribe = result.subscribe
  result.subscribe = function(callback) {
    const unsub = originalSubscribe.call(this, callback)
    return () => {
      unsub()
      if (sourceUnsub) {
        sourceUnsub()
        sourceUnsub = null
      }
    }
  }
  
  return result
} 