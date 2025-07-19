import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { reactive } from '../reactive'
import { zodMap } from '../operators/zodMap'
import { collect, createColdObservable } from './utils'

describe('zodMap operator', () => {
  const userSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email().optional()
  })

  type User = z.infer<typeof userSchema>

  describe('Basic validation', () => {
    it('passes valid data through', async () => {
      const source = reactive<User>({ id: 1, name: 'Alice' })
      const validated = zodMap(source, userSchema)
      
      const result = await collect(validated)
      expect(result).toEqual([{ id: 1, name: 'Alice' }])
    })

    it('throws on invalid data by default', async () => {
      const source = reactive({ id: 1, name: 'Alice' })
      source.set({ id: 'invalid', name: 'Bob' } as any)
      
      const validated = zodMap(source, userSchema)
      
      await expect(collect(validated)).rejects.toThrow()
    })

    it('filters invalid data when filterInvalid=true', async () => {
      const source = reactive<User>({ id: 1, name: 'Alice' })
      source.set({ id: 2, name: 'Bob' })
      source.set({ id: 'invalid', name: 'Charlie' } as any)
      source.set({ id: 3, name: 'David' })
      
      const validated = zodMap(source, userSchema, { filterInvalid: true })
      
      const result = await collect(validated)
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'David' }
      ])
    })
  })

  describe('Schema transformations', () => {
    it('applies schema transformations', async () => {
      const transformSchema = z.object({
        id: z.number(),
        name: z.string().transform(name => name.toUpperCase()),
        email: z.string().email().optional()
      })

      const source = reactive({ id: 1, name: 'alice', email: 'alice@example.com' })
      const validated = zodMap(source, transformSchema)
      
      const result = await collect(validated)
      expect(result).toEqual([{ id: 1, name: 'ALICE', email: 'alice@example.com' }])
    })

    it('handles optional fields correctly', async () => {
      const source = reactive<User>({ id: 1, name: 'Alice' })
      source.set({ id: 2, name: 'Bob', email: 'bob@example.com' })
      
      const validated = zodMap(source, userSchema)
      
      const result = await collect(validated)
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob', email: 'bob@example.com' }
      ])
    })
  })

  describe('Error handling', () => {
    it('provides detailed error information', async () => {
      const source = reactive({ id: 'invalid', name: 123 } as any)
      
      const validated = zodMap(source, userSchema)
      
      try {
        await collect(validated)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('Expected number')
      }
    })

    it('handles multiple validation errors', async () => {
      const source = reactive({ id: 'invalid', name: 123, email: 'not-an-email' } as any)
      
      const validated = zodMap(source, userSchema)
      
      try {
        await collect(validated)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        // Should contain multiple error messages
        expect(error.message).toContain('Expected number')
        expect(error.message).toContain('Expected string')
      }
    })
  })

  describe('Integration with other operators', () => {
    it('works with map operator', async () => {
      const source = reactive({ id: 1, name: 'Alice' })
      source.set({ id: 2, name: 'Bob' })
      
      const validated = zodMap(source, userSchema)
      const names = validated.map((users: User[]) => users.map(u => u.name))
      
      const result = await collect(names)
      expect(result).toEqual([['Alice'], ['Alice', 'Bob']])
    })

    it('works with filter operator', async () => {
      const source = reactive({ id: 1, name: 'Alice' })
      source.set({ id: 2, name: 'Bob' })
      source.set({ id: 3, name: 'Charlie' })
      
      const validated = zodMap(source, userSchema)
      const longNames = validated.filter((users: User[]) => 
        users.some(u => u.name.length > 4)
      )
      
      const result = await collect(longNames)
      expect(result).toEqual([
        [{ id: 3, name: 'Charlie' }]
      ])
    })
  })

  describe('Cold observable integration', () => {
    it('validates cold observable emissions', async () => {
      const cold = createColdObservable([
        { id: 1, name: 'Alice' },
        { id: 'invalid', name: 'Bob' } as any,
        { id: 3, name: 'Charlie' }
      ], 10)
      
      const validated = zodMap(cold, userSchema, { filterInvalid: true })
      
      const result = await collect(validated)
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 3, name: 'Charlie' }
      ])
    })

    it('handles timing with validation', async () => {
      const cold = createColdObservable([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ], 20)
      
      const validated = zodMap(cold, userSchema)
      
      const result = await collect(validated)
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ])
    })
  })

  describe('Unsubscription behavior', () => {
    it('properly cleans up subscriptions', async () => {
      const source = reactive({ id: 1, name: 'Alice' })
      const validated = zodMap(source, userSchema)
      
      const results: User[][] = []
      const unsubscribe = validated.subscribe(val => results.push(val))
      
      source.set({ id: 2, name: 'Bob' })
      unsubscribe()
      source.set({ id: 3, name: 'Charlie' })
      
      expect(results).toEqual([
        [{ id: 1, name: 'Alice' }],
        [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
      ])
      // Should not include the third emission
    })

    it('handles rapid subscribe/unsubscribe cycles', () => {
      const source = reactive({ id: 1, name: 'Alice' })
      const validated = zodMap(source, userSchema)
      
      for (let i = 0; i < 5; i++) {
        const unsubscribe = validated.subscribe(() => {})
        source.set({ id: i + 1, name: `User${i}` })
        unsubscribe()
      }
      
      // Should not throw or cause memory leaks
      expect(true).toBe(true)
    })
  })

  describe('Complex schemas', () => {
    it('handles nested object validation', async () => {
      const nestedSchema = z.object({
        id: z.number(),
        profile: z.object({
          name: z.string(),
          age: z.number().min(0)
        }),
        tags: z.array(z.string())
      })

      const source = reactive({
        id: 1,
        profile: { name: 'Alice', age: 25 },
        tags: ['admin', 'user']
      })
      
      const validated = zodMap(source, nestedSchema)
      
      const result = await collect(validated)
      expect(result).toEqual([{
        id: 1,
        profile: { name: 'Alice', age: 25 },
        tags: ['admin', 'user']
      }])
    })

    it('validates array schemas', async () => {
      const arraySchema = z.array(z.object({
        id: z.number(),
        name: z.string()
      }))

      const source = reactive([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ])
      
      const validated = zodMap(source, arraySchema)
      
      const result = await collect(validated)
      expect(result).toEqual([[
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]])
    })
  })
}) 