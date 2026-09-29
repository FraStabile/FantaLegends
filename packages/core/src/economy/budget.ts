import type { LeagueConfig, Team } from '../domain/types';
import { remainingSlots } from '../team/teamValidation';

/**
 * Game economy guard.
 *
 * A team must always be able to complete its roster: after winning the current
 * lot, every remaining empty slot needs at least `minPrice` credits.
 *
 *   100 credits, 5 empty slots, minPrice 1  →  max bid = 100 − 4·1 = 96
 */
export function minimumRequiredBudget(team: Team, cfg: LeagueConfig, slotsAfterThisPurchase?: number): number {
  const slots = slotsAfterThisPurchase ?? Math.max(0, remainingSlots(team, cfg) - 1);
  return slots * cfg.minPrice;
}

/** Highest bid the team may place on the current lot. 0 if the roster is already complete. */
export function maxBid(team: Team, cfg: LeagueConfig): number {
  const remaining = remainingSlots(team, cfg);
  if (remaining === 0) return 0;
  return Math.max(0, team.credits - minimumRequiredBudget(team, cfg, remaining - 1));
}
