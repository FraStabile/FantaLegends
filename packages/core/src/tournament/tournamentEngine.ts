import type { League, MatchSummary, StandingRow, Tournament } from '../domain/types';
import { DomainError } from '../domain/errors';
import type { Rng } from '../util/rng';
import { doubleRoundRobin, drawGroups, makeMatch, nextPowerOfTwo, roundRobin, stageForBracket, type Fixture } from './schedule';
import { computeStandings } from './standings';

/** Standard bracket order for seeds 1..size: [1,8,4,5,2,7,3,6] for 8. */
export function bracketOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order.slice(0, size);
}

function seedBracket(seeds: string[]): (string | null)[] {
  const size = nextPowerOfTwo(Math.max(2, seeds.length));
  return bracketOrder(size).map((s) => seeds[s - 1] ?? null);
}

/**
 * TournamentEngine — generates the calendar and moves the competition through
 * its phases (regular season / groups → knockout stages → champion).
 */
export const TournamentEngine = {
  create(league: League, rng: Rng): Tournament {
    const ids = rng.shuffle(league.teams.map((t) => t.id));
    const { format } = league.config;
    const t: Tournament = {
      format,
      currentRound: 1,
      totalRounds: 0,
      phase: 'regular',
      groups: null,
      bracket: null,
      matches: [],
      championTeamId: null,
    };

    if (format === 'knockout') {
      t.phase = 'playoffs';
      t.bracket = seedBracket(ids);
      scheduleKnockoutStage(league, t, 1, rng);
    } else if (format === 'groups_knockout') {
      t.groups = drawGroups(ids, rng);
      const perGroup = Object.entries(t.groups).map(([g, teams]) => ({ g, rounds: league.config.homeAway ? doubleRoundRobin(teams) : roundRobin(teams) }));
      const maxRounds = Math.max(...perGroup.map((x) => x.rounds.length));
      for (let r = 0; r < maxRounds; r++) {
        let idx = 0;
        for (const { g, rounds } of perGroup) for (const f of rounds[r] ?? []) t.matches.push(makeMatch(league.id, league.season, r + 1, idx++, 'group', g, f, rng));
      }
    } else {
      const rounds = format === 'double_round_robin' ? doubleRoundRobin(ids) : roundRobin(ids);
      rounds.forEach((fixtures, r) => fixtures.forEach((f, i) => t.matches.push(makeMatch(league.id, league.season, r + 1, i, 'league', null, f, rng))));
    }
    t.totalRounds = estimateTotalRounds(league, t);
    return t;
  },

  /** Matches of the next round to be played (empty when the tournament is over). */
  pendingRound(t: Tournament): MatchSummary[] {
    const pending = t.matches.filter((m) => m.status !== 'finished');
    if (!pending.length) return [];
    const round = Math.min(...pending.map((m) => m.round));
    return pending.filter((m) => m.round === round);
  },

  /**
   * Called after every finished round. Generates the next knockout stage when the
   * current phase is over, and crowns the champion at the end.
   */
  advance(league: League, rng: Rng): { stageCreated: boolean; completed: boolean } {
    const t = league.tournament;
    if (!t) throw new DomainError('INVALID_STATE');
    if (TournamentEngine.pendingRound(t).length) {
      t.currentRound = TournamentEngine.pendingRound(t)[0].round;
      return { stageCreated: false, completed: false };
    }
    const lastRound = Math.max(0, ...t.matches.map((m) => m.round));
    const standings = computeStandings(league.teams.map((x) => x.id), t.matches, t.groups);

    if (t.phase === 'regular') {
      const qualified = qualifiers(league, standings, t);
      if (!qualified) {
        t.phase = 'completed';
        t.championTeamId = standings[0]?.teamId ?? null;
        return { stageCreated: false, completed: true };
      }
      t.phase = 'playoffs';
      t.bracket = qualified;
      scheduleKnockoutStage(league, t, lastRound + 1, rng);
      t.currentRound = lastRound + 1;
      t.totalRounds = estimateTotalRounds(league, t);
      return { stageCreated: true, completed: false };
    }

    // knockout stage finished: winners (or bye teams) move on in bracket order
    const bracket = t.bracket ?? [];
    const next: (string | null)[] = [];
    for (let i = 0; i < bracket.length; i += 2) {
      const a = bracket[i];
      const b = bracket[i + 1];
      if (!a || !b) {
        next.push(a ?? b ?? null);
        continue;
      }
      const m = t.matches.find((x) => x.stage !== 'league' && x.stage !== 'group' && x.round === lastRound && ((x.homeTeamId === a && x.awayTeamId === b) || (x.homeTeamId === b && x.awayTeamId === a)));
      next.push(m ? winnerOf(m) : a);
    }
    if (next.length <= 1) {
      t.phase = 'completed';
      t.championTeamId = next[0] ?? null;
      t.bracket = next;
      return { stageCreated: false, completed: true };
    }
    t.bracket = next;
    scheduleKnockoutStage(league, t, lastRound + 1, rng);
    t.currentRound = lastRound + 1;
    return { stageCreated: true, completed: false };
  },

  isKnockout(m: MatchSummary): boolean {
    return m.stage !== 'league' && m.stage !== 'group';
  },
};

export function winnerOf(m: MatchSummary): string | null {
  if (m.status !== 'finished') return null;
  if (m.homeGoals! > m.awayGoals!) return m.homeTeamId;
  if (m.awayGoals! > m.homeGoals!) return m.awayTeamId;
  if (m.homePens !== null && m.awayPens !== null) return m.homePens > m.awayPens ? m.homeTeamId : m.awayTeamId;
  return null;
}

function qualifiers(league: League, standings: StandingRow[], t: Tournament): (string | null)[] | null {
  const { config } = league;
  if (t.groups) {
    const names = Object.keys(t.groups).sort();
    const byGroup = (g: string) => standings.filter((r) => r.group === g).map((r) => r.teamId);
    if (names.length === 2) {
      const [A, B] = names.map(byGroup);
      // cross semifinals: A1–B2, B1–A2
      return [A[0], B[1] ?? null, B[0], A[1] ?? null];
    }
    // three groups: winners + best runner-up
    const winners = names.map((g) => byGroup(g)[0]);
    const runners = standings.filter((r) => names.some((g) => byGroup(g)[1] === r.teamId)).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
    return seedBracket([...winners, runners[0]?.teamId].filter((x): x is string => !!x));
  }
  if (!config.playoffs || league.teams.length < 3) return null;
  const n = Math.min(config.playoffTeams, league.teams.length >= 4 ? 4 : 2);
  return seedBracket(standings.slice(0, n).map((r) => r.teamId));
}

function scheduleKnockoutStage(league: League, t: Tournament, round: number, rng: Rng): void {
  const bracket = t.bracket!;
  const stage = stageForBracket(bracket.length);
  let idx = 0;
  for (let i = 0; i < bracket.length; i += 2) {
    const a = bracket[i];
    const b = bracket[i + 1];
    if (!a || !b) continue; // bye
    const f: Fixture = { home: a, away: b };
    t.matches.push(makeMatch(league.id, league.season, round, idx++, stage, null, f, rng));
  }
}

function estimateTotalRounds(league: League, t: Tournament): number {
  const regular = Math.max(0, ...t.matches.filter((m) => !TournamentEngine.isKnockout(m)).map((m) => m.round));
  const koTeams = t.bracket ? t.bracket.length : t.groups ? 4 : league.config.playoffs && league.teams.length >= 3 ? Math.min(league.config.playoffTeams, league.teams.length >= 4 ? 4 : 2) : 0;
  const koRounds = koTeams > 1 ? Math.log2(nextPowerOfTwo(koTeams)) : 0;
  const played = t.bracket ? Math.max(0, ...t.matches.filter((m) => TournamentEngine.isKnockout(m)).map((m) => m.round)) - regular : 0;
  return regular + Math.max(koRounds, played);
}
