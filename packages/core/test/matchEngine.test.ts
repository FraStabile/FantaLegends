import { describe, expect, it } from 'vitest';
import { CATALOG_PLAYERS, simulateMatch } from '../src/index';
import { byName, input, STRONG, WEAK } from './fixtures';

describe('MatchEngine', () => {
  it('is deterministic for a given seed', () => {
    const a = simulateMatch(input(99, STRONG, WEAK));
    const b = simulateMatch(input(99, STRONG, WEAK));
    expect(a).toEqual(b);
  });

  it('the final score is the sum of the goal events (no invented result)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = simulateMatch(input(seed, STRONG, WEAK));
      const scoring = r.events.filter((e) => e.type === 'goal' || e.type === 'own_goal' || e.type === 'penalty_scored');
      const homeGoals = scoring.filter((e) => (e.type === 'own_goal' ? e.teamId === 'A' : e.teamId === 'H')).length;
      const awayGoals = scoring.length - homeGoals;
      expect([r.homeGoals, r.awayGoals]).toEqual([homeGoals, awayGoals]);
      const last = r.events[r.events.length - 1];
      expect(last.type).toBe('fulltime');
      expect([last.homeGoals, last.awayGoals]).toEqual([r.homeGoals, r.awayGoals]);
      const scorerGoals = r.playerStats.reduce((s, p) => s + p.goals, 0);
      const ownGoals = r.events.filter((e) => e.type === 'own_goal').length;
      expect(scorerGoals + ownGoals).toBe(r.homeGoals + r.awayGoals);
    }
  });

  it('duels and fouls always involve players of opposite teams', () => {
    const teamOf = new Map<string, string>([...STRONG.map((p) => [p.id, 'H'] as const), ...WEAK.map((p) => [p.id, 'A'] as const)]);
    const duels = new Set(['foul', 'yellow', 'tackle', 'interception', 'dribble', 'blocked', 'save', 'penalty_scored', 'penalty_missed', 'shootout_kick']);
    for (let seed = 1; seed <= 80; seed++) {
      const r = simulateMatch(input(seed, STRONG, WEAK, { knockout: seed % 4 === 0 }));
      for (const e of r.events) {
        if (!duels.has(e.type) || !e.playerId || !e.secondaryPlayerId) continue;
        expect(teamOf.get(e.playerId), `${e.type}: ${e.commentary}`).not.toBe(teamOf.get(e.secondaryPlayerId));
      }
    }
  });

  it('never narrates a missing secondary actor as "un compagno"', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = simulateMatch(input(seed, STRONG, WEAK));
      for (const e of r.events) expect(e.commentary).not.toMatch(/un compagno/i);
    }
  });

  it('produces a chronological minute-by-minute timeline', () => {
    const r = simulateMatch(input(7, STRONG, WEAK));
    expect(r.events[0].type).toBe('kickoff');
    for (let i = 1; i < r.events.length; i++) {
      expect(r.events[i].t).toBeGreaterThanOrEqual(r.events[i - 1].t);
      expect(r.events[i].seq).toBe(i);
    }
    expect(r.events.some((e) => e.type === 'halftime')).toBe(true);
    expect(r.totalTime).toBeGreaterThanOrEqual(r.events[r.events.length - 1].t);
    expect(r.homeStats.possession + r.awayStats.possession).toBe(100);
    for (const e of r.events) expect(e.commentary.length).toBeGreaterThan(5);
  });

  it('the stronger team wins more often, but upsets happen', () => {
    let strongWins = 0;
    let weakWins = 0;
    const N = 300;
    for (let seed = 1; seed <= N; seed++) {
      const r = simulateMatch(input(seed * 31, STRONG, WEAK));
      if (r.homeGoals > r.awayGoals) strongWins++;
      if (r.homeGoals < r.awayGoals) weakWins++;
    }
    expect(strongWins / N).toBeGreaterThan(0.6);
    expect(weakWins).toBeGreaterThan(0);
    expect(weakWins / N).toBeLessThan(0.25);
  });

  it('equal teams produce balanced outcomes with a realistic number of goals', () => {
    let home = 0, away = 0, goals = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const r = simulateMatch(input(seed, STRONG, STRONG));
      if (r.homeGoals > r.awayGoals) home++;
      if (r.awayGoals > r.homeGoals) away++;
      goals += r.homeGoals + r.awayGoals;
    }
    expect(Math.abs(home - away) / N).toBeLessThan(0.12);
    expect(goals / N).toBeGreaterThan(1.5);
    expect(goals / N).toBeLessThan(5);
  });

  it('knockout matches always have a winner (penalty shoot-out)', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = simulateMatch(input(seed, STRONG, STRONG, { knockout: true }));
      if (r.homeGoals === r.awayGoals) {
        expect(r.homePens).not.toBeNull();
        expect(r.homePens).not.toBe(r.awayPens);
        expect(r.events.some((e) => e.type === 'shootout_start')).toBe(true);
      } else {
        expect(r.homePens).toBeNull();
      }
    }
  });

  it('uses individual stats, not the overall: a great goalkeeper concedes less', () => {
    const keeperA = byName('Gianluigi Buffon');
    const keeperB = CATALOG_PLAYERS.filter((p) => p.position === 'GK').sort((a, b) => a.overall - b.overall)[0];
    const outfield = STRONG.slice(1);
    let concededWithBuffon = 0;
    let concededWithWeak = 0;
    for (let seed = 1; seed <= 300; seed++) {
      concededWithBuffon += simulateMatch(input(seed, [keeperA, ...WEAK.slice(1)], [WEAK[0], ...outfield])).awayGoals;
      concededWithWeak += simulateMatch(input(seed, [keeperB, ...WEAK.slice(1)], [WEAK[0], ...outfield])).awayGoals;
    }
    expect(concededWithBuffon).toBeLessThan(concededWithWeak);
  });

  it('player ratings and MVP come from match events', () => {
    const r = simulateMatch(input(5, STRONG, WEAK));
    expect(r.playerStats).toHaveLength(10);
    for (const p of r.playerStats) {
      expect(p.rating).toBeGreaterThanOrEqual(4);
      expect(p.rating).toBeLessThanOrEqual(10);
    }
    const best = Math.max(...r.playerStats.map((p) => p.rating));
    expect(r.playerStats.find((p) => p.playerId === r.mvpPlayerId)!.rating).toBe(best);
  });
});
