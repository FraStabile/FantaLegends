import { describe, expect, it } from 'vitest';
import { LeagueHost, type League } from '../src/index';
import { MASTER, auction, bid, lot, teamOf } from './helpers';

/** Simulates persistence: the league goes through JSON (like SQLite) and a brand new host is built. */
function rehydrate(host: LeagueHost, scheduler: ConstructorParameters<typeof LeagueHost>[2]['scheduler']) {
  const saved = JSON.parse(JSON.stringify(host.state)) as League;
  const results = JSON.parse(JSON.stringify(host.allResults()));
  host.dispose();
  return new LeagueHost(saved, results, { scheduler, botsEnabled: false });
}

describe('Reconnect & recovery', () => {
  it('a reconnecting client recovers the current lot, the bid and the timer from the snapshot', () => {
    const { host, scheduler } = auction();
    bid(host, MASTER, 12);
    host.setConnected('u-marco', false);
    scheduler.advance(3_000);
    host.setConnected('u-marco', true);
    const view = host.view('u-marco');
    expect(view.auction.currentLot?.currentBid).toBe(12);
    expect(view.auction.currentLot?.leaderTeamId).toBe(teamOf(host, MASTER).id);
    // opening timer 15s (a bid resets to max(remaining, 10s)), 3s elapsed
    expect(view.auction.currentLot!.endsAt - view.serverNow).toBe(12_000);
    expect(view.members.find((m) => m.userId === 'u-marco')?.connected).toBe(true);
    // missed events are in the snapshot: bid history and feed
    expect(view.auction.currentLot?.bids.map((b) => b.amount)).toEqual([12]);
  });

  it('presence changes are tracked per member', () => {
    const { host } = auction();
    host.setConnected('u-marco', false);
    expect(host.state.members.find((m) => m.userId === 'u-marco')?.connected).toBe(false);
    const v = host.state.version;
    host.setConnected('u-marco', false);
    expect(host.state.version).toBe(v);
  });

  it('a host rebuilt from persisted state re-arms the lot timer (server restart)', () => {
    const { host, scheduler } = auction();
    bid(host, MASTER, 20);
    const lotId = lot(host).id;
    const restored = rehydrate(host, scheduler);
    expect(restored.state.auction.currentLot?.id).toBe(lotId);
    // bids keep working on the restored host and the lot still closes
    restored.placeBid('u-marco', { lotId, amount: 21, bidId: 'after-restart' });
    scheduler.advance(15_000);
    expect(restored.state.auction.lastResult).toMatchObject({ teamId: 't-u-marco', price: 21 });
  });

  it('idempotency survives the restart (retry of an already processed bid)', () => {
    const { host, scheduler } = auction();
    const lotId = lot(host).id;
    host.placeBid(MASTER, { lotId, amount: 5, bidId: 'retry-me' });
    const restored = rehydrate(host, scheduler);
    expect(restored.placeBid(MASTER, { lotId, amount: 5, bidId: 'retry-me' }).duplicate).toBe(true);
    expect(restored.state.auction.currentLot?.bids).toHaveLength(1);
  });

  it('users can leave the lobby, but not a running auction', () => {
    const { host } = auction();
    expect(() => host.leave('u-marco')).toThrow('INVALID_STATE');
  });
});
