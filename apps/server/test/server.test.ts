import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ManualScheduler, type LeagueView } from '@asta/core';
import { createApp } from '../src/app.js';
import { config as baseConfig } from '../src/config.js';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type AppHandle = Awaited<ReturnType<typeof createApp>>;
let dir: string;
let handle: AppHandle;
let base: string;
const sockets: Socket[] = [];

async function start(dbPath = join(dir, 'test.db'), scheduler?: ManualScheduler) {
  handle = await createApp({ ...baseConfig, databasePath: dbPath, expoPushEnabled: false, aiEnabled: false }, { scheduler });
  await handle.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = handle.app.server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
}

async function api<T = any>(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as T };
}

async function guest(name: string) {
  const { data } = await api('POST', '/auth/guest', undefined, { displayName: name, avatar: '⚽' });
  return data as { token: string; user: { id: string } };
}

function socket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(base, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function emit<T = any>(s: Socket, event: string, payload: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  return new Promise((resolve) => s.emit(event, payload, resolve));
}

function nextState(s: Socket, predicate: (v: LeagueView) => boolean, timeoutMs = 8000): Promise<LeagueView> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting state')), timeoutMs);
    const on = (v: LeagueView) => {
      if (predicate(v)) {
        clearTimeout(timer);
        s.off('league:state', on);
        resolve(v);
      }
    };
    s.on('league:state', on);
  });
}

/** Two humans in a league with a fast auction. */
async function setupLeague() {
  const a = await guest('Francesco');
  const b = await guest('Marco');
  const created = await api('POST', '/leagues', a.token, { config: { name: 'Champions degli Scappati', startingCredits: 100, openingTimerSeconds: 5, bidTimerSeconds: 3, liveMatchSeconds: 20 }, teamName: 'Francesco FC' });
  const league = created.data.league as LeagueView;
  await api('POST', '/leagues/join', b.token, { code: league.code, teamName: 'Marco United' });
  const sa = await socket(a.token);
  const sb = await socket(b.token);
  await emit(sa, 'league:subscribe', { leagueId: league.id });
  await emit(sb, 'league:subscribe', { leagueId: league.id });
  await emit(sb, 'lobby:ready', { leagueId: league.id, ready: true });
  return { a, b, sa, sb, league };
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'asta-'));
  await start();
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await handle.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('REST API', () => {
  it('creates a league with an invite code and lets a friend join by code', async () => {
    const a = await guest('Francesco');
    const b = await guest('Marco');
    const created = await api('POST', '/leagues', a.token, { config: { name: 'Champions degli Scappati' } });
    expect(created.status).toBe(200);
    const code = created.data.league.code as string;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.data.inviteUrl).toContain(code);

    const preview = await api('GET', `/invite/${code}`);
    expect(preview.data.name).toBe('Champions degli Scappati');

    const joined = await api('POST', '/leagues/join', b.token, { code: code.toLowerCase() });
    expect(joined.data.league.members).toHaveLength(2);
    const mine = await api('GET', '/leagues', b.token);
    expect(mine.data.leagues[0].code).toBe(code);
  });

  it('rejects unauthenticated and non-member access', async () => {
    const a = await guest('Francesco');
    const c = await guest('Intruso');
    const created = await api('POST', '/leagues', a.token, { config: { name: 'Privata' } });
    expect((await api('GET', '/leagues')).status).toBe(401);
    expect((await api('GET', `/leagues/${created.data.league.id}`, c.token)).status).toBe(403);
    expect((await api('POST', '/leagues', a.token, { config: { name: 'x', maxParticipants: 99 } })).status).toBe(400);
  });

  it('AI generator falls back to the offline database and requires Master confirmation', async () => {
    const a = await guest('Francesco');
    const b = await guest('Marco');
    const { data } = await api('POST', '/leagues', a.token, { config: { name: 'AI League' } });
    const id = data.league.id;
    await api('POST', '/leagues/join', b.token, { code: data.league.code });
    expect((await api('POST', `/leagues/${id}/ai/generate`, b.token, { prompt: 'Genera 10 giocatori' })).status).toBe(403);
    const gen = await api('POST', `/leagues/${id}/ai/generate`, a.token, { prompt: 'Genera 12 giocatori storici, dal 1990 al 2010, distribuiti in modo equilibrato per ruolo.' });
    expect(gen.data.source).toBe('offline');
    expect(gen.data.items.length).toBeGreaterThanOrEqual(10);
    const confirm = await api('POST', `/leagues/${id}/ai/confirm`, a.token, { generationId: gen.data.generationId });
    expect(confirm.data.added).toBe(gen.data.items.length);
    expect(confirm.data.league.customItems).toHaveLength(gen.data.items.length);
    // a generation cannot be replayed
    expect((await api('POST', `/leagues/${id}/ai/confirm`, a.token, { generationId: gen.data.generationId })).status).toBe(404);

    const custom = await api('POST', `/leagues/${id}/custom-players`, a.token, { name: 'Gianni Il Cugino', position: 'FW', overall: 71 });
    expect(custom.data.item.source).toBe('custom');
  });
});

describe('Realtime auction', () => {
  it('broadcasts the live auction to everyone and only the server decides the winner', async () => {
    const { sa, sb, league } = await setupLeague();
    const opened = nextState(sb, (v) => v.auction.status === 'lot_open');
    expect((await emit(sa, 'auction:start', { leagueId: league.id })).ok).toBe(true);
    const view = await opened;
    const lot = view.auction.currentLot!;
    expect(view.auction).not.toHaveProperty('queue');

    const seen = nextState(sb, (v) => v.auction.currentLot?.currentBid === 7);
    expect((await emit(sa, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 7, bidId: 'bid-a-000001' })).ok).toBe(true);
    const bView = await seen;
    expect(bView.auction.currentLot?.leaderTeamId).toBe(view.teams.find((t) => t.name === 'Francesco FC')!.id);

    const sold = nextState(sa, (v) => v.auction.status === 'lot_sold');
    const result = (await sold).auction.lastResult!;
    expect(result).toMatchObject({ itemId: lot.itemId, price: 7 });
    const me = (await nextState(sa, () => true, 6000).catch(() => bView)).teams;
    expect(me).toBeTruthy();
  });

  it('two simultaneous bids with the same amount: exactly one is accepted', async () => {
    const { a, sa, sb, league } = await setupLeague();
    const c = await guest('Luca');
    // Luca cannot join a running auction, so the race is between the two members
    const opened = nextState(sa, (v) => v.auction.status === 'lot_open');
    await emit(sa, 'auction:start', { leagueId: league.id });
    const lot = (await opened).auction.currentLot!;
    const [ra, rb] = await Promise.all([
      emit(sa, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 10, bidId: 'race-a-00001' }),
      emit(sb, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 10, bidId: 'race-b-00001' }),
    ]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    expect([ra.error, rb.error].filter(Boolean)).toEqual(['BID_TOO_LOW']);
    // duplicate request with the same id is idempotent
    const dup = await emit(ra.ok ? sa : sb, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 10, bidId: ra.ok ? 'race-a-00001' : 'race-b-00001' });
    expect(dup).toMatchObject({ ok: true, data: { duplicate: true } });
    // a client cannot bid for another team: the team is derived from the token
    const stranger = await socket(c.token);
    expect((await emit(stranger, 'league:subscribe', { leagueId: league.id })).error).toBe('FORBIDDEN');
    expect((await emit(stranger, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 11, bidId: 'strange-0001' })).error).toBe('FORBIDDEN');
    expect(a.user.id).toBeTruthy();
  });

  it('notifies the outbid user', async () => {
    const { sa, sb, league } = await setupLeague();
    const opened = nextState(sa, (v) => v.auction.status === 'lot_open');
    await emit(sa, 'auction:start', { leagueId: league.id });
    const lot = (await opened).auction.currentLot!;
    const outbid = new Promise<any>((resolve) => sa.on('notification', (n) => n.kind === 'outbid' && resolve(n)));
    await emit(sa, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 3, bidId: 'nb-a-000001' });
    await emit(sb, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 4, bidId: 'nb-b-000001' });
    const n = await outbid;
    expect(n.title).toContain('superato');
  });

  it('reconnect: presence goes offline, and re-subscribing restores lot, bid and timer', async () => {
    const { b, sa, sb, league } = await setupLeague();
    const opened = nextState(sa, (v) => v.auction.status === 'lot_open');
    await emit(sa, 'auction:start', { leagueId: league.id });
    const lot = (await opened).auction.currentLot!;
    const offline = nextState(sa, (v) => v.members.some((m) => m.displayName === 'Marco' && !m.connected));
    sb.disconnect();
    await offline;
    await emit(sa, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 9, bidId: 'rc-a-000001' });

    const sb2 = await socket(b.token);
    const sync = await emit(sb2, 'time:sync', {});
    const res = await emit<LeagueView>(sb2, 'league:subscribe', { leagueId: league.id });
    const view = res.data!;
    expect(view.auction.currentLot?.id).toBe(lot.id);
    expect(view.auction.currentLot?.currentBid).toBe(9);
    expect(view.auction.currentLot!.endsAt).toBeGreaterThan((sync.data as { serverNow: number }).serverNow);
    expect(view.members.find((m) => m.displayName === 'Marco')?.connected).toBe(true);
  });
});

describe('Persistence', () => {
  it('a restarted server resumes the auction from SQLite', async () => {
    const { a, sa, league } = await setupLeague();
    const opened = nextState(sa, (v) => v.auction.status === 'lot_open');
    await emit(sa, 'auction:start', { leagueId: league.id });
    const lot = (await opened).auction.currentLot!;
    await emit(sa, 'auction:bid', { leagueId: league.id, lotId: lot.id, amount: 13, bidId: 'ps-a-000001' });
    for (const s of sockets.splice(0)) s.disconnect();
    const dbPath = join(dir, 'test.db');
    await handle.close();

    await start(dbPath);
    const { data } = await api('GET', `/leagues/${league.id}`, a.token);
    const view = data.league as LeagueView;
    expect(view.status).toBe('auction');
    expect(view.auction.currentLot?.id).toBe(lot.id);
    expect(view.auction.currentLot?.currentBid).toBe(13);
    // the timer was re-armed: the lot gets sold to the pre-restart leader
    const s = await socket(a.token);
    await emit(s, 'league:subscribe', { leagueId: league.id });
    const sold = await nextState(s, (v) => v.auction.results.length > 0);
    expect(sold.auction.results[0]).toMatchObject({ itemId: lot.itemId, price: 13 });
    expect(sold.teams.find((t) => t.name === 'Francesco FC')!.credits).toBe(87);
  });

  it('persists a whole season played by bots, with matches, events and stats', async () => {
    const a = await guest('Francesco');
    const created = await api('POST', '/leagues', a.token, { config: { name: 'Bot League', format: 'round_robin', playoffs: false, openingTimerSeconds: 5, bidTimerSeconds: 3 } });
    const league = created.data.league as LeagueView;
    const s = await socket(a.token);
    await emit(s, 'league:subscribe', { leagueId: league.id });
    await emit(s, 'lobby:addBots', { leagueId: league.id, archetypes: ['shark', 'saver', 'tactician'] });
    // restart on a manual clock so the bots can play the whole auction instantly
    for (const x of sockets.splice(0)) x.disconnect();
    await handle.close();
    const clock = new ManualScheduler(Date.now());
    await start(join(dir, 'test.db'), clock);
    const host = handle.registry.get(league.id);
    host.startAuction(a.user.id);
    clock.runAll();
    const s2 = await socket(a.token);
    await emit(s2, 'league:subscribe', { leagueId: league.id });
    expect(host.state.status).toBe('pre_season');
    expect((await emit(s2, 'season:start', { leagueId: league.id })).ok).toBe(true);
    while (host.state.status === 'season') expect((await emit(s2, 'round:play', { leagueId: league.id, mode: 'instant' })).ok).toBe(true);
    expect(host.state.status).toBe('completed');

    const matchId = host.state.tournament!.matches[0].id;
    const detail = await api('GET', `/leagues/${league.id}/matches/${matchId}`, a.token);
    expect(detail.data.match.final).not.toBeNull();
    expect(detail.data.match.events.length).toBeGreaterThan(10);
    const count = (sql: string) => (handle.db.prepare(sql).get(league.id) as { n: number }).n;
    expect(count('SELECT COUNT(*) n FROM matches WHERE league_id = ? AND status = \'finished\'')).toBe(6);
    expect(count('SELECT COUNT(*) n FROM match_events e JOIN matches m ON m.id = e.match_id WHERE m.league_id = ?')).toBeGreaterThan(100);
    expect(count('SELECT COUNT(*) n FROM statistics WHERE league_id = ?')).toBe(6 * 10);
    expect(count('SELECT COUNT(*) n FROM team_players WHERE league_id = ?')).toBe(4 * 6);
    expect(count('SELECT COUNT(*) n FROM seasons WHERE league_id = ?')).toBe(1);
    expect(count('SELECT COUNT(*) n FROM awards WHERE league_id = ?')).toBeGreaterThan(5);
    // DB-level guard against double purchase
    const row = handle.db.prepare('SELECT * FROM team_players WHERE league_id = ? LIMIT 1').get(league.id) as Record<string, unknown>;
    expect(() => handle.db.prepare('INSERT INTO team_players (league_id, season, team_id, item_id, kind, slot, price, lot_number, auto_assigned, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(league.id, 1, row.team_id as string, row.item_id as string, 'player', 'FW', 1, 99, 0, 99)).toThrow(/UNIQUE/);
    const stats = await api('GET', `/leagues/${league.id}/stats`, a.token);
    expect(stats.data.stats.players.length).toBe(4 * 5);
  }, 60_000);
});
