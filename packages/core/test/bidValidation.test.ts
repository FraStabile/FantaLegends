import { describe, expect, it } from 'vitest';
import { maxBid, minimumRequiredBudget, SOLD_PAUSE_MS, type Slot } from '../src/index';
import { MASTER, auction, bid, expireLot, lot, teamOf } from './helpers';
import type { LeagueHost, ManualScheduler } from '../src/index';

/** Advance lots until one of the requested slot is open. */
function openLotOf(host: LeagueHost, scheduler: ManualScheduler, slot: Slot) {
  for (let i = 0; i < 400; i++) {
    const a = host.state.auction;
    if (a.status === 'lot_open' && a.currentLot?.slot === slot) return a.currentLot;
    if (a.status === 'lot_open') expireLot(host, scheduler);
    else scheduler.advance(SOLD_PAUSE_MS);
  }
  throw new Error(`no ${slot} lot`);
}

describe('BidValidation', () => {
  it('rejects bids above the available credits', () => {
    const { host } = auction();
    expect(() => bid(host, MASTER, 101)).toThrow('INSUFFICIENT_CREDITS');
  });

  it('keeps a minimum budget to complete the roster (economy guard)', () => {
    const { host } = auction();
    const team = teamOf(host, MASTER);
    // 100 credits, 6 empty slots: after this purchase 5 slots need 1 credit each
    expect(minimumRequiredBudget(team, host.state.config)).toBe(5);
    expect(maxBid(team, host.state.config)).toBe(95);
    expect(() => bid(host, MASTER, 96)).toThrow('BUDGET_RESERVE');
    expect(bid(host, MASTER, 95).duplicate).toBe(false);
  });

  it('rejects a bid for a role that is already complete', () => {
    const { host, scheduler } = auction();
    openLotOf(host, scheduler, 'GK');
    bid(host, MASTER, 1);
    expireLot(host, scheduler);
    scheduler.advance(SOLD_PAUSE_MS);
    openLotOf(host, scheduler, 'GK');
    expect(() => bid(host, MASTER, 1)).toThrow('ROLE_FULL');
    expect(bid(host, 'u-marco', 1).duplicate).toBe(false);
  });

  it('rejects bids lower than current + minimum increment', () => {
    const { host } = auction({ config: { minIncrement: 2 } });
    bid(host, MASTER, 10);
    expect(() => bid(host, 'u-marco', 11)).toThrow('BID_TOO_LOW');
    expect(bid(host, 'u-marco', 12).duplicate).toBe(false);
  });

  it('rejects self-outbidding and non integer amounts', () => {
    const { host } = auction();
    bid(host, MASTER, 5);
    expect(() => bid(host, MASTER, 6)).toThrow('ALREADY_LEADING');
    expect(() => bid(host, 'u-marco', 6.5)).toThrow('BID_NOT_INTEGER');
  });

  it('rejects bids for a stale lot and from non members', () => {
    const { host, scheduler } = auction();
    const oldLot = lot(host).id;
    expireLot(host, scheduler);
    scheduler.advance(SOLD_PAUSE_MS);
    expect(() => bid(host, MASTER, 1, oldLot)).toThrow('STALE_LOT');
    expect(() => bid(host, 'intruder', 1)).toThrow('FORBIDDEN');
  });

  it('a user with only the reserve left can bid at most the minimum price', () => {
    const { host, scheduler } = auction({ config: { startingCredits: 20 } });
    // 20 credits, 6 slots → max bid 15
    bid(host, MASTER, 15);
    expireLot(host, scheduler);
    scheduler.advance(SOLD_PAUSE_MS);
    expect(teamOf(host, MASTER).credits).toBe(5);
    openLotOf(host, scheduler, 'FW');
    // 5 credits, 5 empty slots → only 1 credit per slot
    expect(() => bid(host, MASTER, 2)).toThrow('BUDGET_RESERVE');
    expect(bid(host, MASTER, 1).duplicate).toBe(false);
  });

  it('rejects everything while paused', () => {
    const { host } = auction();
    host.pauseAuction(MASTER);
    expect(() => bid(host, 'u-marco', 1)).toThrow('AUCTION_PAUSED');
  });
});
