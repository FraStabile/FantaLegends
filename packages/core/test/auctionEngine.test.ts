import { describe, expect, it } from 'vitest';
import { Catalog, SOLD_PAUSE_MS, isTeamComplete, projectLeague } from '../src/index';
import { MASTER, auction, bid, expireLot, lot, teamOf } from './helpers';

describe('AuctionEngine', () => {
  it('opens a random lot from the pool without revealing the next one', () => {
    const { host } = auction();
    const l = lot(host);
    expect(host.state.pool).toContain(l.itemId);
    expect(l.number).toBe(1);
    expect(l.currentBid).toBe(0);
    const view = projectLeague(host.state as never, MASTER, host.now());
    expect(view.auction).not.toHaveProperty('queue');
    expect(view.auction).not.toHaveProperty('unsold');
    expect(view.pool).toEqual([...host.state.pool].sort());
    expect(JSON.stringify(view.auction)).not.toContain(host.state.auction.queue[0]);
    expect(view.auction.remainingTotal).toBe(host.state.auction.queue.length);
  });

  it('assigns the lot to the last bidder when the timer expires, deducting credits', () => {
    const { host, scheduler } = auction();
    const l = lot(host);
    bid(host, MASTER, 5);
    bid(host, 'u-marco', 8);
    bid(host, MASTER, 12);
    expireLot(host, scheduler);

    const me = teamOf(host, MASTER);
    expect(me.credits).toBe(100 - 12);
    expect(me.roster).toHaveLength(1);
    expect(me.roster[0]).toMatchObject({ itemId: l.itemId, price: 12, lotNumber: 1 });
    expect(teamOf(host, 'u-marco').credits).toBe(100);
    expect(host.state.auction.status).toBe('lot_sold');
    expect(host.state.auction.lastResult).toMatchObject({ itemId: l.itemId, teamId: me.id, price: 12, bidCount: 3 });
  });

  it('resets the timer on every bid and opens the next lot after the SOLD pause', () => {
    const { host, scheduler } = auction({ config: { bidTimerSeconds: 10, openingTimerSeconds: 15 } });
    const opened = lot(host);
    expect(opened.endsAt - scheduler.now()).toBe(15_000);
    scheduler.advance(12_000);
    bid(host, MASTER, 3);
    // 3s were left, the bid resets the countdown to 10s
    expect(lot(host).endsAt - scheduler.now()).toBe(10_000);
    scheduler.advance(9_999);
    expect(host.state.auction.status).toBe('lot_open');
    scheduler.advance(1);
    expect(host.state.auction.status).toBe('lot_sold');
    scheduler.advance(SOLD_PAUSE_MS);
    expect(lot(host).number).toBe(2);
  });

  it('puts unsold items back and retries them once the queue is empty', () => {
    const { host, scheduler } = auction();
    const first = lot(host).itemId;
    expireLot(host, scheduler);
    expect(host.state.auction.lastResult).toMatchObject({ itemId: first, teamId: null });
    expect(host.state.auction.unsold).toContain(first);
  });

  it('discards unsold items by default: no lot is ever called twice', () => {
    const { host, scheduler } = auction();
    expect(host.state.config.unsoldPolicy).toBe('discard');
    scheduler.runAll();
    const called = host.state.auction.results.filter((r) => !r.autoAssigned).map((r) => r.itemId);
    expect(new Set(called).size).toBe(called.length);
  });

  it("with the 'requeue' policy unsold items get a second call", () => {
    const { host, scheduler } = auction({ config: { unsoldPolicy: 'requeue' } });
    scheduler.runAll();
    const called = host.state.auction.results.filter((r) => !r.autoAssigned).map((r) => r.itemId);
    expect(new Set(called).size).toBeLessThan(called.length);
  });

  it('completes every roster, auto-assigning at minimum price when nobody bids', () => {
    const { host, scheduler } = auction();
    scheduler.runAll();
    expect(host.state.auction.status).toBe('completed');
    expect(host.state.status).toBe('pre_season');
    for (const t of host.state.teams) {
      expect(isTeamComplete(t, host.state.config)).toBe(true);
      expect(t.roster.every((r) => r.autoAssigned && r.price === 1)).toBe(true);
    }
  });

  it('never assigns the same item twice and respects the role structure', () => {
    const { host, scheduler } = auction({ humans: 4 });
    // everyone bids on everything they can: the auction must still be consistent
    let guard = 0;
    while (host.state.auction.status !== 'completed' && guard++ < 500) {
      if (host.state.auction.status === 'lot_open') {
        for (const u of ['u-master', 'u-marco', 'u-luca', 'u-giulia']) {
          try {
            bid(host, u, lot(host).leaderTeamId ? lot(host).currentBid + 1 : 1);
          } catch {
            /* invalid bids are expected (role full, reserve…) */
          }
        }
        expireLot(host, scheduler);
      } else scheduler.advance(SOLD_PAUSE_MS);
    }
    const owned = host.state.teams.flatMap((t) => t.roster.map((r) => r.itemId));
    expect(new Set(owned).size).toBe(owned.length);
    const catalog = new Catalog();
    for (const t of host.state.teams) {
      const bySlot = (s: string) => t.roster.filter((r) => r.slot === s).length;
      expect([bySlot('GK'), bySlot('DF'), bySlot('MF'), bySlot('FW'), bySlot('COACH')]).toEqual([1, 1, 1, 2, 1]);
      for (const r of t.roster) expect(Catalog.slotOf(catalog.get(r.itemId))).toBe(r.slot);
      expect(t.credits).toBeGreaterThanOrEqual(0);
      expect(t.credits + t.roster.reduce((s, r) => s + r.price, 0)).toBe(100);
    }
  });

  it('pause freezes the countdown and resume restores it', () => {
    const { host, scheduler } = auction();
    scheduler.advance(5_000);
    host.pauseAuction(MASTER);
    scheduler.advance(60_000);
    expect(host.state.auction.status).toBe('paused');
    host.resumeAuction(MASTER);
    expect(host.state.auction.status).toBe('lot_open');
    expect(lot(host).endsAt - scheduler.now()).toBe(10_000);
    expect(() => host.pauseAuction('u-marco')).toThrow('FORBIDDEN');
  });
});
