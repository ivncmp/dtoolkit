import { z } from "zod";

// --- Entity types ---

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

// --- Tier (memory decay) ---

export const Tier = z.enum(["hot", "warm", "cold"]);
export type Tier = z.infer<typeof Tier>;

// --- Fact ---

export const FactSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  fact: z.string(),
  category: z.string(),
  timestamp: z.string(),
  status: z.enum(["active", "superseded"]).default("active"),
  supersededBy: z.string().nullable().default(null),
  relatedEntities: z.array(z.string()).default([]),
  lastAccessed: z.string(),
  accessCount: z.number().default(0),
  tier: Tier.default("warm"),
  source: z.string().nullable().default(null),
});
export type Fact = z.infer<typeof FactSchema>;

// --- Entity ---

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

// --- ContextBlock (neutral contract between all dtoolkit products) ---

export const ContextBlockSchema = z.object({
  source: z.string(),
  priority: z.number(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ContextBlock = z.infer<typeof ContextBlockSchema>;
