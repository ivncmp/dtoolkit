import { z } from "zod";

export const EntityType = z.enum([
  "project",
  "person",
  "system",
  "event",
  "resource",
]);
export type EntityType = z.infer<typeof EntityType>;

export const ParaCategory = z.enum([
  "projects",
  "areas",
  "resources",
  "archives",
]);
export type ParaCategory = z.infer<typeof ParaCategory>;

export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: EntityType,
  category: ParaCategory,
  status: z.string().default("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type Entity = z.infer<typeof EntitySchema>;
