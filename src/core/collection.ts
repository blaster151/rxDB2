import { z } from "zod"
import type { ZodTypeAny, infer as zInfer } from "zod"

export type CollectionDefinition<
  Name extends string,
  Schema extends ZodTypeAny
> = {
  name: Name
  schema: Schema
  Document: zInfer<Schema> // phantom field for TS inference
}

export function defineCollection<
  Name extends string,
  Schema extends ZodTypeAny
>(name: Name, schema: Schema): CollectionDefinition<Name, Schema> {
  return {
    name,
    schema,
    Document: undefined as unknown as zInfer<Schema>
  }
} 