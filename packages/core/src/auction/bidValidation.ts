import type { League, Lot, Team } from '../domain/types';
import { DomainError, type ErrorCode } from '../domain/errors';
import { maxBid } from '../economy/budget';
import { canAcquireSlot, isTeamComplete } from '../team/teamValidation';

export interface BidRequest {
  teamId: string;
  /** the lot the client is looking at: protects from bidding on a lot that changed */
  lotId: string;
  amount: number;
  /** client generated idempotency key */
  bidId: string;
}

export type BidCheck = { ok: true } | { ok: false; code: ErrorCode };

/** Lowest amount the next bid on this lot must reach. */
export function minimumNextBid(lot: Lot, league: League): number {
  return lot.leaderTeamId ? lot.currentBid + league.config.minIncrement : league.config.minPrice;
}

/**
 * Pure server-side validation of a bid. Order matters: the cheapest and most
 * "global" checks first, so users get the most relevant reason.
 */
export function validateBid(league: League, team: Team | undefined, req: BidRequest, now: number): BidCheck {
  const { auction, config } = league;
  const fail = (code: ErrorCode): BidCheck => ({ ok: false, code });

  if (!team) return fail('FORBIDDEN');
  if (league.status !== 'auction') return fail('INVALID_STATE');
  if (auction.status === 'paused') return fail('AUCTION_PAUSED');
  const lot = auction.currentLot;
  if (auction.status !== 'lot_open' || !lot) return fail('NO_OPEN_LOT');
  if (lot.id !== req.lotId) return fail('STALE_LOT');
  // the timer is authoritative: a bid arriving at/after endsAt loses even if the close job has not run yet
  if (now >= lot.endsAt) return fail('LOT_CLOSED');
  if (!Number.isInteger(req.amount) || req.amount <= 0) return fail('BID_NOT_INTEGER');
  if (isTeamComplete(team, config)) return fail('ROSTER_FULL');
  if (!canAcquireSlot(team, config, lot.slot)) return fail('ROLE_FULL');
  if (lot.leaderTeamId === team.id) return fail('ALREADY_LEADING');
  if (req.amount < minimumNextBid(lot, league)) return fail('BID_TOO_LOW');
  if (req.amount > team.credits) return fail('INSUFFICIENT_CREDITS');
  if (req.amount > maxBid(team, config)) return fail('BUDGET_RESERVE');
  return { ok: true };
}

export function assertBid(league: League, team: Team | undefined, req: BidRequest, now: number): void {
  const res = validateBid(league, team, req, now);
  if (!res.ok) throw new DomainError(res.code);
}
