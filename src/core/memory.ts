import type { Config } from './config.js';
import type { Tier } from './models.js';

export function computeTier(
  lastAccessed: string,
  accessCount: number,
  tiers: Config['tiers'],
): Tier {
  const daysSince = Math.floor((Date.now() - new Date(lastAccessed).getTime()) / 86_400_000);

  if (daysSince <= tiers.hotDays || accessCount >= tiers.hotMinAccess) return 'hot';
  if (daysSince <= tiers.warmDays) return 'warm';
  return 'cold';
}
