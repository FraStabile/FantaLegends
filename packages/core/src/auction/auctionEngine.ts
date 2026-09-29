import type { AuctionState, League, Lot, LotResult, Slot, Team } from '../domain/types';
import { DomainError } from '../domain/errors';
import type { DomainEvent } from '../events/types';
import { Catalog } from '../catalog/catalog';
import { isTeamComplete, slotNeeds } from '../team/teamValidation';
import { assertBid, type BidRequest } from './bidValidation';
import type { Rng } from '../util/rng';

/** How long the SOLD! overlay stays before the next lot is drawn. */
export const SOLD_PAUSE_MS = 3500;
/** Minimum time left on a lot after the auction is resumed. */
export const RESUME_MIN_MS = 5000;
/** With the 'requeue' policy, an item that goes unsold this many times is removed from the auction. */
export const MAX_UNSOLD_ATTEMPTS = 2;
const MAX_PROCESSED_IDS = 500;

export function createAuctionState(): AuctionState {
  return {
    status: 'not_started',
    queue: [],
    unsold: [],
    lotCounter: 0,
    currentLot: null,
    lastResult: null,
    nextLotAt: null,
    results: [],
    pausedRemainingMs: null,
    processedBidIds: [],
  };
}

/**
 * AuctionEngine — pure, synchronous state transitions of the live auction.
 *
 * The engine never reads a clock: `now` is always passed in by the host, which
 * serialises every command for a league. Because each transition validates first
 * and mutates after, a rejected command never leaves partial state behind; since
 * commands run one at a time there are no interleavings, hence no race conditions.
 */
export const AuctionEngine = {
  start(league: League, rng: Rng, now: number): DomainEvent[] {
    if (league.status !== 'auction' || league.auction.status !== 'not_started') throw new DomainError('INVALID_STATE');
    const a = league.auction;
    a.queue = rng.shuffle(league.pool);
    a.unsold = [];
    a.results = [];
    a.lotCounter = 0;
    const events: DomainEvent[] = [{ type: 'AuctionStarted', poolSize: league.pool.length }];
    return events.concat(AuctionEngine.openNextLot(league, now));
  },

  /** Draw the next useful item. Completes the auction when every roster is full. */
  openNextLot(league: League, now: number): DomainEvent[] {
    const a = league.auction;
    if (a.status === 'completed') return [];
    const catalog = new Catalog(league.customItems);
    const events: DomainEvent[] = [];

    if (league.teams.every((t) => isTeamComplete(t, league.config))) {
      return events.concat(complete(league));
    }

    const soldIds = new Set(a.results.filter((r) => r.teamId).map((r) => r.itemId));
    const needed = neededSlots(league);

    for (;;) {
      if (a.queue.length === 0) {
        // second chance for items nobody wanted (only if the league requeues them), then automatic assignment
        const requeue = league.config.unsoldPolicy === 'requeue';
        const retry = requeue ? a.unsold.filter((id) => unsoldAttempts(a, id) < MAX_UNSOLD_ATTEMPTS && needed.has(Catalog.slotOf(catalog.get(id)))) : [];
        a.unsold = [];
        if (retry.length === 0) return events.concat(autoAssign(league, catalog, now), complete(league));
        a.queue = retry;
      }
      const itemId = a.queue.shift()!;
      if (soldIds.has(itemId)) continue;
      const slot = Catalog.slotOf(catalog.get(itemId));
      if (!needed.has(slot)) continue; // nobody can buy it anymore: discard silently

      a.lotCounter += 1;
      const lot: Lot = {
        id: `${league.id}-L${league.season}-${a.lotCounter}`,
        number: a.lotCounter,
        itemId,
        kind: slot === 'COACH' ? 'coach' : 'player',
        slot,
        openedAt: now,
        endsAt: now + league.config.openingTimerSeconds * 1000,
        currentBid: 0,
        leaderTeamId: null,
        bids: [],
      };
      a.currentLot = lot;
      a.status = 'lot_open';
      a.nextLotAt = null;
      events.push({ type: 'LotOpened', lotId: lot.id, number: lot.number, itemId, slot, endsAt: lot.endsAt });
      return events;
    }
  },

  /**
   * Place a bid. Returns `duplicate: true` (and no events) for a bid id that was
   * already processed, so network retries and double taps are harmless.
   */
  placeBid(league: League, req: BidRequest, now: number): { events: DomainEvent[]; duplicate: boolean } {
    const a = league.auction;
    if (a.processedBidIds.includes(req.bidId)) return { events: [], duplicate: true };
    const team = league.teams.find((t) => t.id === req.teamId);
    assertBid(league, team, req, now);

    const lot = a.currentLot!;
    const previousLeader = lot.leaderTeamId;
    const previousAmount = lot.currentBid;
    lot.currentBid = req.amount;
    lot.leaderTeamId = team!.id;
    lot.bids.push({ id: req.bidId, lotId: lot.id, teamId: team!.id, amount: req.amount, at: now });
    a.processedBidIds.push(req.bidId);
    if (a.processedBidIds.length > MAX_PROCESSED_IDS) a.processedBidIds.splice(0, a.processedBidIds.length - MAX_PROCESSED_IDS);

    const events: DomainEvent[] = [];
    const resetTo = now + league.config.bidTimerSeconds * 1000;
    const extended = resetTo > lot.endsAt;
    if (extended) lot.endsAt = resetTo;
    events.push({ type: 'BidPlaced', lotId: lot.id, itemId: lot.itemId, teamId: team!.id, amount: req.amount, previousAmount, endsAt: lot.endsAt });
    if (extended) events.push({ type: 'AuctionExtended', lotId: lot.id, endsAt: lot.endsAt });
    if (previousLeader && previousLeader !== team!.id) {
      events.push({ type: 'Outbid', lotId: lot.id, itemId: lot.itemId, teamId: previousLeader, byTeamId: team!.id, amount: req.amount });
    }
    return { events, duplicate: false };
  },

  /**
   * Close the current lot. Only valid once the timer has expired (server clock),
   * which makes an early/duplicate close request a no-op.
   */
  closeLot(league: League, now: number): DomainEvent[] {
    const a = league.auction;
    const lot = a.currentLot;
    if (a.status !== 'lot_open' || !lot) return [];
    if (now < lot.endsAt) return [];

    const events: DomainEvent[] = [];
    a.currentLot = null;
    a.status = 'lot_sold';
    a.nextLotAt = now + SOLD_PAUSE_MS;

    if (!lot.leaderTeamId) {
      const result: LotResult = { lotId: lot.id, number: lot.number, itemId: lot.itemId, kind: lot.kind, slot: lot.slot, teamId: null, price: 0, bidCount: 0, closedAt: now, autoAssigned: false };
      a.results.push(result);
      a.lastResult = result;
      a.unsold.push(lot.itemId);
      events.push({ type: 'LotUnsold', lotId: lot.id, itemId: lot.itemId });
      return events;
    }

    const team = league.teams.find((t) => t.id === lot.leaderTeamId)!;
    const result = assign(league, team, lot.itemId, lot.slot, lot.currentBid, lot.number, now, false, lot.bids.length, lot.id);
    events.push({ type: 'PlayerSold', result });
    if (isTeamComplete(team, league.config)) events.push({ type: 'TeamCompleted', teamId: team.id });
    return events;
  },

  pause(league: League, now: number): DomainEvent[] {
    const a = league.auction;
    if (a.status !== 'lot_open' && a.status !== 'lot_sold') throw new DomainError('INVALID_STATE');
    a.pausedRemainingMs = a.status === 'lot_open' && a.currentLot ? Math.max(0, a.currentLot.endsAt - now) : null;
    a.status = 'paused';
    return [{ type: 'AuctionPaused' }];
  },

  resume(league: League, now: number): DomainEvent[] {
    const a = league.auction;
    if (a.status !== 'paused') throw new DomainError('INVALID_STATE');
    if (a.currentLot) {
      a.currentLot.endsAt = now + Math.max(RESUME_MIN_MS, a.pausedRemainingMs ?? 0);
      a.status = 'lot_open';
    } else {
      a.status = 'lot_sold';
      a.nextLotAt = now;
    }
    a.pausedRemainingMs = null;
    return [{ type: 'AuctionResumed', endsAt: a.currentLot?.endsAt ?? null }];
  },
};

function unsoldAttempts(a: AuctionState, itemId: string): number {
  return a.results.filter((r) => r.itemId === itemId && r.teamId === null).length;
}

function neededSlots(league: League): Set<Slot> {
  const set = new Set<Slot>();
  for (const t of league.teams) {
    const needs = slotNeeds(t, league.config);
    for (const [slot, n] of Object.entries(needs) as [Slot, number][]) if (n > 0) set.add(slot);
  }
  return set;
}

function assign(
  league: League,
  team: Team,
  itemId: string,
  slot: Slot,
  price: number,
  lotNumber: number,
  now: number,
  autoAssigned: boolean,
  bidCount: number,
  lotId: string,
): LotResult {
  // defensive invariant: the same item can never be owned twice (DB enforces it too)
  if (league.teams.some((t) => t.roster.some((r) => r.itemId === itemId))) throw new DomainError('ALREADY_SOLD');
  if (price > team.credits) throw new DomainError('INSUFFICIENT_CREDITS');
  team.credits -= price;
  team.roster.push({ itemId, kind: slot === 'COACH' ? 'coach' : 'player', slot, price, lotNumber, autoAssigned });
  const result: LotResult = { lotId, number: lotNumber, itemId, kind: slot === 'COACH' ? 'coach' : 'player', slot, teamId: team.id, price, bidCount, closedAt: now, autoAssigned };
  league.auction.results.push(result);
  league.auction.lastResult = result;
  return result;
}

/**
 * "Assegnazione d'ufficio": when the pool is exhausted, every missing slot is
 * filled at the minimum price with the weakest remaining item of that role.
 */
function autoAssign(league: League, catalog: Catalog, now: number): DomainEvent[] {
  const events: DomainEvent[] = [];
  const owned = new Set(league.teams.flatMap((t) => t.roster.map((r) => r.itemId)));
  const available = league.pool
    .filter((id) => !owned.has(id))
    .map((id) => catalog.get(id))
    .sort((x, y) => x.overall - y.overall);

  for (const team of league.teams) {
    if (isTeamComplete(team, league.config)) continue;
    const needs = slotNeeds(team, league.config);
    for (const [slot, n] of Object.entries(needs) as [Slot, number][]) {
      for (let i = 0; i < n; i++) {
        const idx = available.findIndex((it) => Catalog.slotOf(it) === slot);
        if (idx < 0) break;
        const item = available.splice(idx, 1)[0];
        league.auction.lotCounter += 1;
        const price = Math.min(league.config.minPrice, team.credits);
        const lotNo = league.auction.lotCounter;
        const result = assign(league, team, item.id, slot, price, lotNo, now, true, 0, `${league.id}-L${league.season}-${lotNo}`);
        events.push({ type: 'PlayerSold', result });
      }
    }
    if (isTeamComplete(team, league.config)) events.push({ type: 'TeamCompleted', teamId: team.id });
  }
  return events;
}

function complete(league: League): DomainEvent[] {
  const a = league.auction;
  a.status = 'completed';
  a.currentLot = null;
  a.nextLotAt = null;
  a.queue = [];
  a.unsold = [];
  league.status = 'pre_season';
  return [{ type: 'AuctionCompleted' }];
}
