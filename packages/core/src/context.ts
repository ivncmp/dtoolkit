import { z } from "zod";

export const ContextBlockSchema = z.object({
  source: z.string(),
  priority: z.number(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ContextBlock = z.infer<typeof ContextBlockSchema>;
