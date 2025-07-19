import { reactive } from '../reactive'
import { ZodSchema } from 'zod'

export interface ZodMapOptions {
  filterInvalid?: boolean
  transform?: boolean
}

export function zodMap<TIn, TOut>(
  source: any,
  schema: ZodSchema<TOut>,
  opts: ZodMapOptions = {}
): any {
  const result = reactive([] as TOut[])
  let sourceUnsub: (() => void) | null = null
  
  sourceUnsub = source.subscribe((val: TIn) => {
    const parsed = schema.safeParse(val)
    if (parsed.success) {
      result.set([...result.get(), parsed.data])
    } else if (!opts.filterInvalid) {
      throw parsed.error
    }
    // else: silently skip invalid data
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