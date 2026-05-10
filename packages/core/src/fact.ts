import { z } from "zod";

export const Tier = z.enum(["hot", "warm", "cold"]);
export type Tier = z.infer<typeof Tier>;

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

export interface TierConfig {
  hotDays: number;
  hotMinAccess: number;
  warmDays: number;
}

export function computeTier(
  lastAccessed: string,
  accessCount: number,
  tiers: TierConfig,
): Tier {
  const daysSince = Math.floor(
    (Date.now() - new Date(lastAccessed).getTime()) / 86_400_000,
  );

  if (daysSince <= tiers.hotDays || accessCount >= tiers.hotMinAccess)
    return "hot";
  if (daysSince <= tiers.warmDays) return "warm";
  return "cold";
}
