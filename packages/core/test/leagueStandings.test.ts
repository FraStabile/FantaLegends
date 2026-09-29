import { describe, expect, it } from 'vitest';
import { bracketOrder, computeStandings, doubleRoundRobin, roundRobin, type MatchSummary } from '../src/index';

const finished = (round: number, home: string, away: string, hg: number, ag: number): MatchSummary => ({
  id: `${round}-${home}-${away}`, round, stage: 'league', group: null, homeTeamId: home, awayTeamId: away, status: 'finished', seed: 1,
  kickoffAt: 0, homeGoals: hg, awayGoals: ag, homePens: null, awayPens: null, mvpPlayerId: null,
});

describe('Schedule', () => {
  it('round robin: every pair meets exactly once, one match per team per round', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const ids = Array.from({ length: n }, (_, i) => `T${i}`);
      const rounds = roundRobin(ids);
      const pairs = new Set<string>();
      for (const round of rounds) {
        const seen = new Set<string>();
        for (const f of round) {
          expect(seen.has(f.home) || seen.has(f.away)).toBe(false);
          seen.add(f.home).add(f.away);
          pairs.add([f.home, f.away].sort().join('|'));
        }
      }
      expect(pairs.size).toBe((n * (n - 1)) / 2);
      expect(rounds.flat()).toHaveLength((n * (n - 1)) / 2);
    }
  });

  it('double round robin: each pair plays home and away', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const all = doubleRoundRobin(ids).flat();
    expect(all).toHaveLength(12);
    for (const a of ids) for (const b of ids) if (a !== b) expect(all.filter((f) => f.home === a && f.away === b)).toHaveLength(1);
  });

  it('home games are balanced in a round robin', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const all = roundRobin(ids).flat();
    for (const id of ids) {
      const home = all.filter((f) => f.home === id).length;
      expect(home).toBeGreaterThanOrEqual(2);
      expect(home).toBeLessThanOrEqual(3);
    }
  });

  it('seeded bracket order keeps top seeds apart', () => {
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('LeagueStandings', () => {
  it('computes points, goals and form', () => {
    const rows = computeStandings(['A', 'B', 'C'], [finished(1, 'A', 'B', 3, 1), finished(2, 'B', 'C', 0, 0), finished(3, 'C', 'A', 2, 1)]);
    const a = rows.find((r) => r.teamId === 'A')!;
    expect(a).toMatchObject({ played: 2, won: 1, lost: 1, drawn: 0, goalsFor: 4, goalsAgainst: 3, goalDiff: 1, points: 3, form: ['W', 'L'] });
    const b = rows.find((r) => r.teamId === 'B')!;
    expect(b).toMatchObject({ played: 2, points: 1, goalDiff: -2 });
  });

  it('orders by points, then goal difference, then goals scored, then head to head', () => {
    const rows = computeStandings(
      ['A', 'B', 'C', 'D'],
      [finished(1, 'A', 'C', 1, 0), finished(1, 'B', 'D', 3, 2), finished(2, 'A', 'B', 0, 1), finished(2, 'C', 'D', 5, 0)],
    );
    // A: 3pt (+0, 1 GF)  B: 6pt  C: 3pt (+4)  D: 0pt
    expect(rows.map((r) => r.teamId)).toEqual(['B', 'C', 'A', 'D']);
    const h2h = computeStandings(['X', 'Y'], [finished(1, 'X', 'Y', 2, 1), finished(2, 'Y', 'X', 2, 1)]);
    expect(h2h[0].points).toBe(h2h[1].points);
  });

  it('ignores knockout and unfinished matches', () => {
    const ko = { ...finished(5, 'A', 'B', 4, 0), stage: 'final' as const };
    const live = { ...finished(6, 'A', 'B', 4, 0), status: 'live' as const };
    const rows = computeStandings(['A', 'B'], [ko, live]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});
