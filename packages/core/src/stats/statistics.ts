import type { MatchResult, MatchSummary } from '../domain/types';

export interface PlayerSeasonStats {
  playerId: string;
  teamId: string;
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  mvps: number;
  avgRating: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  dribbles: number;
  tackles: number;
  saves: number;
  yellows: number;
  reds: number;
  goalsConceded: number;
  xg: number;
}

export interface TeamSeasonStats {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  avgPossession: number;
  avgShots: number;
  xgFor: number;
  xgAgainst: number;
  cleanSheets: number;
}

export interface SeasonStatistics {
  players: PlayerSeasonStats[];
  teams: TeamSeasonStats[];
}

/** Aggregates every finished match of the season. Pure: the source of truth are the match results. */
export function computeStatistics(results: MatchResult[], matches: MatchSummary[]): SeasonStatistics {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const players = new Map<string, PlayerSeasonStats & { ratingSum: number }>();
  const teams = new Map<string, TeamSeasonStats & { possSum: number; shotSum: number }>();

  const team = (id: string) => {
    let t = teams.get(id);
    if (!t) teams.set(id, (t = { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, avgPossession: 0, avgShots: 0, xgFor: 0, xgAgainst: 0, cleanSheets: 0, possSum: 0, shotSum: 0 }));
    return t;
  };

  for (const r of results) {
    const m = byId.get(r.matchId);
    if (!m) continue;
    const sides = [
      { id: m.homeTeamId, gf: r.homeGoals, ga: r.awayGoals, s: r.homeStats, o: r.awayStats },
      { id: m.awayTeamId, gf: r.awayGoals, ga: r.homeGoals, s: r.awayStats, o: r.homeStats },
    ];
    const pensWinner = r.homePens !== null && r.awayPens !== null ? (r.homePens > r.awayPens ? m.homeTeamId : m.awayTeamId) : null;
    for (const x of sides) {
      const t = team(x.id);
      t.played++;
      t.goalsFor += x.gf;
      t.goalsAgainst += x.ga;
      if (x.gf > x.ga || pensWinner === x.id) t.won++;
      else if (x.gf < x.ga || pensWinner) t.lost++;
      else t.drawn++;
      t.possSum += x.s.possession;
      t.shotSum += x.s.shots;
      t.xgFor += x.s.xg;
      t.xgAgainst += x.o.xg;
      if (x.ga === 0) t.cleanSheets++;
    }
    for (const ps of r.playerStats) {
      let p = players.get(ps.playerId);
      if (!p) {
        players.set(ps.playerId, (p = {
          playerId: ps.playerId, teamId: ps.teamId, apps: 0, goals: 0, assists: 0, cleanSheets: 0, mvps: 0, avgRating: 0,
          shots: 0, shotsOnTarget: 0, passes: 0, dribbles: 0, tackles: 0, saves: 0, yellows: 0, reds: 0, goalsConceded: 0, xg: 0, ratingSum: 0,
        }));
      }
      p.apps++;
      p.goals += ps.goals;
      p.assists += ps.assists;
      p.cleanSheets += ps.cleanSheet ? 1 : 0;
      p.mvps += r.mvpPlayerId === ps.playerId ? 1 : 0;
      p.ratingSum += ps.rating;
      p.shots += ps.shots;
      p.shotsOnTarget += ps.shotsOnTarget;
      p.passes += ps.passes;
      p.dribbles += ps.dribbles;
      p.tackles += ps.tackles;
      p.saves += ps.saves;
      p.yellows += ps.yellow;
      p.reds += ps.red;
      p.goalsConceded += ps.goalsConceded;
      p.xg += ps.xg;
    }
  }

  const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    players: [...players.values()].map(({ ratingSum, ...p }) => ({ ...p, avgRating: round(ratingSum / Math.max(1, p.apps)), xg: round(p.xg) })),
    teams: [...teams.values()].map(({ possSum, shotSum, ...t }) => ({
      ...t,
      avgPossession: round(possSum / Math.max(1, t.played), 1),
      avgShots: round(shotSum / Math.max(1, t.played), 1),
      xgFor: round(t.xgFor),
      xgAgainst: round(t.xgAgainst),
    })),
  };
}

export type PlayerLeaderboardKey = 'goals' | 'assists' | 'cleanSheets' | 'mvps' | 'avgRating' | 'shots' | 'passes' | 'dribbles' | 'saves' | 'yellows' | 'goalsConceded' | 'tackles';

export function leaderboard(stats: PlayerSeasonStats[], key: PlayerLeaderboardKey, limit = 10, minApps = 1): PlayerSeasonStats[] {
  return stats
    .filter((s) => s.apps >= minApps && (key === 'avgRating' || s[key] > 0))
    .sort((a, b) => b[key] - a[key] || b.avgRating - a.avgRating)
    .slice(0, limit);
}
