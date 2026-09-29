import { describe, expect, it } from 'vitest';
import { AuctionEngine, SOLD_PAUSE_MS } from '../src/index';
import { MASTER, auction, bid, lot, teamOf } from './helpers';

describe('Race conditions', () => {
  it('two users bidding the same amount at the same instant: only the first is accepted', () => {
    const { host } = auction({ humans: 3 });
    bid(host, MASTER, 10);
    // both see 10 and send 11 in the same tick
    const results = ['u-marco', 'u-luca'].map((u) => {
      try {
        bid(host, u, 11);
        return 'ok';
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(results).toEqual(['ok', 'BID_TOO_LOW']);
    expect(lot(host).leaderTeamId).toBe(teamOf(host, 'u-marco').id);
    expect(lot(host).bids).toHaveLength(2);
  });

  it('a bid arriving when the timer has already expired loses, even before the close job runs', () => {
    const { host, scheduler } = auction();
    bid(host, MASTER, 10);
    const endsAt = lot(host).endsAt;
    // freeze time exactly at expiry without firing timers
    (scheduler as unknown as { current: number }).current = endsAt;
    expect(() => bid(host, 'u-marco', 11)).toThrow('LOT_CLOSED');
    scheduler.advance(0);
    expect(host.state.auction.lastResult).toMatchObject({ teamId: teamOf(host, MASTER).id, price: 10 });
  });

  it('a bid 1ms before expiry is accepted and extends the lot', () => {
    const { host, scheduler } = auction();
    bid(host, MASTER, 10);
    scheduler.advance(lot(host).endsAt - scheduler.now() - 1);
    bid(host, 'u-marco', 11);
    expect(lot(host).endsAt).toBe(scheduler.now() + host.state.config.bidTimerSeconds * 1000);
    scheduler.advance(host.state.config.bidTimerSeconds * 1000);
    expect(host.state.auction.lastResult).toMatchObject({ teamId: teamOf(host, 'u-marco').id, price: 11 });
  });

  it('duplicate requests (network retry / double tap with same id) are idempotent', () => {
    const { host } = auction();
    const lotId = lot(host).id;
    expect(bid(host, MASTER, 7, lotId, 'same-id').duplicate).toBe(false);
    expect(bid(host, MASTER, 7, lotId, 'same-id').duplicate).toBe(true);
    expect(lot(host).bids).toHaveLength(1);
    expect(lot(host).currentBid).toBe(7);
  });

  it('double tap with different ids does not raise against yourself', () => {
    const { host } = auction();
    bid(host, MASTER, 7);
    expect(() => bid(host, MASTER, 8)).toThrow('ALREADY_LEADING');
    expect(lot(host).currentBid).toBe(7);
  });

  it('closing a lot twice cannot assign the player twice', () => {
    const { host, scheduler } = auction();
    bid(host, MASTER, 9);
    scheduler.advance(lot(host).endsAt - scheduler.now());
    const again = AuctionEngine.closeLot(host.state as never, scheduler.now());
    expect(again).toEqual([]);
    expect(teamOf(host, MASTER).roster).toHaveLength(1);
    expect(teamOf(host, MASTER).credits).toBe(91);
  });

  it('a premature close request is ignored: only the server clock decides', () => {
    const { host, scheduler } = auction();
    bid(host, MASTER, 4);
    expect(AuctionEngine.closeLot(host.state as never, scheduler.now())).toEqual([]);
    expect(host.state.auction.status).toBe('lot_open');
    expect(teamOf(host, MASTER).roster).toHaveLength(0);
  });

  it('bids after the lot was sold and during the SOLD pause are rejected', () => {
    const { host, scheduler } = auction();
    const lotId = lot(host).id;
    bid(host, MASTER, 3);
    scheduler.advance(lot(host).endsAt - scheduler.now());
    expect(() => bid(host, 'u-marco', 4, lotId)).toThrow('NO_OPEN_LOT');
    scheduler.advance(SOLD_PAUSE_MS);
    expect(() => bid(host, 'u-marco', 4, lotId)).toThrow('STALE_LOT');
  });
});
