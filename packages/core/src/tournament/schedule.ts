import type { MatchStage, MatchSummary } from '../domain/types';
import type { Rng } from '../util/rng';

export interface Fixture {
  home: string;
  away: string;
}

/**
 * Round robin with the circle method: n−1 rounds (n even), every team plays
 * every other exactly once; home/away is alternated to keep it balanced.
 * With an odd number of teams one team rests each round.
 */
export function roundRobin(teamIds: string[]): Fixture[][] {
  const teams = teamIds.slice();
  if (teams.length % 2 === 1) teams.push('__BYE__');
  const n = teams.length;
  const rounds: Fixture[][] = [];
  const fixed = teams[0];
  let rotating = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const lineup = [fixed, ...rotating];
    const fixtures: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      if (a === '__BYE__' || b === '__BYE__') continue;
      // alternate home for the fixed team, and swap every other pairing
      const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
      fixtures.push(swap ? { home: b, away: a } : { home: a, away: b });
    }
    rounds.push(fixtures);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

/** Second leg: same rounds with home and away inverted. */
export function doubleRoundRobin(teamIds: string[]): Fixture[][] {
  const first = roundRobin(teamIds);
  return [...first, ...first.map((round) => round.map((f) => ({ home: f.away, away: f.home })))];
}

export function stageForBracket(size: number): MatchStage {
  if (size <= 2) return 'final';
  if (size <= 4) return 'semifinal';
  if (size <= 8) return 'quarterfinal';
  return 'round16';
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard seeded bracket pairing (1 v n, 2 v n−1, …) with byes for the top
 * seeds when the number of teams is not a power of two.
 * Returns pairs; `null` means the opponent is a bye.
 */
export function seededPairs(seeds: string[]): [string, string | null][] {
  const size = nextPowerOfTwo(seeds.length);
  const padded: (string | null)[] = [...seeds, ...Array(size - seeds.length).fill(null)];
  const pairs: [string, string | null][] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = padded[i]!;
    const b = padded[size - 1 - i];
    pairs.push([a, b]);
  }
  return pairs;
}

/** Split teams into groups of similar size (A, B, …), randomly. */
export function drawGroups(teamIds: string[], rng: Rng): Record<string, string[]> {
  const count = teamIds.length >= 10 ? 3 : 2;
  const names = ['A', 'B', 'C'].slice(0, count);
  const groups: Record<string, string[]> = Object.fromEntries(names.map((g) => [g, [] as string[]]));
  rng.shuffle(teamIds).forEach((id, i) => groups[names[i % count]].push(id));
  return groups;
}

export function makeMatch(
  leagueId: string,
  season: number,
  round: number,
  index: number,
  stage: MatchStage,
  group: string | null,
  f: Fixture,
  rng: Rng,
): MatchSummary {
  return {
    id: `${leagueId}-S${season}-R${round}-${index}`,
    round,
    stage,
    group,
    homeTeamId: f.home,
    awayTeamId: f.away,
    status: 'scheduled',
    seed: rng.int(1, 2 ** 31 - 1),
    kickoffAt: null,
    homeGoals: null,
    awayGoals: null,
    homePens: null,
    awayPens: null,
    mvpPlayerId: null,
  };
}
