import { describe, expect, it } from 'vitest';
import { isTeamComplete, KICKOFF_DELAY_MS, SOLD_PAUSE_MS, type CompetitionFormat, type DomainEvent } from '../src/index';
import { MASTER, lobby } from './helpers';

function playFullSeason(format: CompetitionFormat, bots = 5, extra: Record<string, unknown> = {}) {
  const { host, scheduler } = lobby({ humans: 1, bots: (['saver', 'shark', 'fan', 'tactician', 'shark', 'tactician', 'fan'] as const).slice(0, bots) as never, botsEnabled: true, config: { format, ...extra } });
  const events: DomainEvent[] = [];
  host.bus.onAny((e) => events.push(e));
  host.startAuction(MASTER);
  scheduler.runAll();
  return { host, scheduler, events };
}

describe('Demo mode: bots + full season', () => {
  it('bots complete the auction with coherent, differentiated rosters', () => {
    const { host, events } = playFullSeason('double_round_robin');
    expect(host.state.status).toBe('pre_season');
    for (const t of host.state.teams) {
      expect(isTeamComplete(t, host.state.config)).toBe(true);
      expect(t.credits).toBeGreaterThanOrEqual(0);
    }
    const bots = host.state.teams.filter((t) => t.ownerId !== MASTER);
    const spent = bots.map((t) => 100 - t.credits);
    // bots actually compete: they spend real money, and not all the same way
    expect(Math.max(...spent)).toBeGreaterThan(40);
    expect(new Set(spent).size).toBeGreaterThan(1);
    expect(events.some((e) => e.type === 'BidPlaced')).toBe(true);
    expect(events.some((e) => e.type === 'Outbid')).toBe(true);
    expect(events.filter((e) => e.type === 'PlayerSold').length).toBe(6 * 6);
    expect(events.at(-1)?.type === 'FeedPosted' || events.some((e) => e.type === 'AuctionCompleted')).toBe(true);
  });

  it('the saver spends less than the shark on average', () => {
    let saver = 0;
    let shark = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { host, scheduler } = lobby({ humans: 1, bots: ['saver', 'shark', 'fan', 'tactician'], botsEnabled: true, seed });
      host.startAuction(MASTER);
      scheduler.runAll();
      const byArchetype = (a: string) => host.state.teams.find((t) => host.state.members.find((m) => m.teamId === t.id)?.bot === a)!;
      const valueOf = (a: string) => byArchetype(a).roster.filter((r) => !r.autoAssigned).reduce((s, r) => s + r.price, 0);
      saver += valueOf('saver');
      shark += valueOf('shark');
    }
    expect(shark).toBeGreaterThan(saver);
  });

  for (const format of ['double_round_robin', 'round_robin', 'groups_knockout', 'knockout'] as CompetitionFormat[]) {
    it(`plays a whole ${format} season to a champion, with awards and history`, () => {
      const { host, scheduler } = playFullSeason(format);
      host.startSeason(MASTER);
      let guard = 0;
      while (host.state.status === 'season' && guard++ < 60) {
        host.playRound(MASTER, guard % 2 ? 'live' : 'instant');
        scheduler.runAll();
      }
      const s = host.state;
      expect(s.status).toBe('completed');
      expect(s.tournament!.championTeamId).toBeTruthy();
      expect(s.tournament!.matches.every((m) => m.status === 'finished')).toBe(true);
      expect(s.awards.find((a) => a.key === 'champion')?.teamId).toBe(s.tournament!.championTeamId);
      for (const key of ['top_scorer', 'mvp', 'best_goalkeeper', 'most_expensive', 'bargain', 'best_buy']) {
        expect(s.awards.some((a) => a.key === key)).toBe(true);
      }
      expect(s.history).toHaveLength(1);
      expect(s.history[0].championTeamId).toBe(s.tournament!.championTeamId);
      expect(s.feed.some((f) => f.kind === 'champion')).toBe(true);
      const stats = host.statistics();
      const goals = stats.players.reduce((sum, p) => sum + p.goals, 0);
      const matchGoals = s.tournament!.matches.reduce((sum, m) => sum + (m.homeGoals ?? 0) + (m.awayGoals ?? 0), 0);
      expect(goals).toBeLessThanOrEqual(matchGoals);
      if (format === 'double_round_robin') expect(s.tournament!.matches.filter((m) => m.stage === 'league')).toHaveLength(30);
    });
  }

  it('live rounds keep the score secret until the final whistle', () => {
    const { host, scheduler } = playFullSeason('round_robin', 3);
    host.startSeason(MASTER);
    const [first] = host.playRound(MASTER, 'live');
    scheduler.advance(KICKOFF_DELAY_MS + 30_000);
    const view = host.view(MASTER).tournament!.matches.find((m) => m.id === first.id)!;
    expect(view.status).toBe('live');
    expect(view.homeGoals).toBeNull();
    const mv = host.matchView(first.id);
    expect(mv.final).toBeNull();
    expect(mv.liveTime).toBeGreaterThan(0);
    const all = host.allResults().find((r) => r.matchId === first.id)!;
    expect(mv.events.length).toBeLessThan(all.events.length);
    expect(mv.events.every((e) => e.t <= mv.liveTime!)).toBe(true);
    expect(() => host.playRound(MASTER)).toThrow();
    scheduler.advance(host.state.config.liveMatchSeconds * 1000);
    const done = host.matchView(first.id);
    expect(done.final).not.toBeNull();
    expect(done.events).toHaveLength(all.events.length);
    expect(done.summary.homeGoals).toBe(all.homeGoals);
  });

  it('a new season keeps the history and resets rosters and credits', () => {
    const { host, scheduler } = playFullSeason('knockout', 3);
    host.startSeason(MASTER);
    while (host.state.status === 'season') {
      host.playRound(MASTER, 'instant');
      scheduler.advance(SOLD_PAUSE_MS);
    }
    host.newSeason(MASTER);
    expect(host.state.season).toBe(2);
    expect(host.state.status).toBe('lobby');
    expect(host.state.history).toHaveLength(1);
    expect(host.state.teams.every((t) => t.roster.length === 0 && t.credits === 100)).toBe(true);
  });
});
