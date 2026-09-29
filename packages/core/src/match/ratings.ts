import type { Player, PlayerMatchStats } from '../domain/types';
import type { Rng } from '../util/rng';

export interface RatingInput {
  teamId: string;
  goalsFor: number;
  goalsAgainst: number;
  won: boolean;
  lost: boolean;
  players: { player: Player; stats: PlayerMatchStats; errors: number; bigMisses: number }[];
}

/**
 * Player match ratings (pagelle), 4.0–10.0, derived only from what the player
 * did in the simulated events, plus a tiny subjective noise.
 */
export function computeRatings(teams: RatingInput[], rng: Rng): PlayerMatchStats[] {
  const out: PlayerMatchStats[] = [];
  for (const t of teams) {
    const clean = t.goalsAgainst === 0;
    for (const { player, stats, errors, bigMisses } of t.players) {
      const pos = player.position;
      let r = 6;
      r += stats.goals * (pos === 'FW' ? 1.0 : 1.25);
      r += stats.assists * 0.7;
      r += stats.keyPasses * 0.15;
      r += stats.shotsOnTarget * 0.1;
      r += stats.dribbles * 0.08;
      r += stats.tackles * (pos === 'DF' ? 0.14 : 0.1);
      r += stats.saves * 0.28;
      r += stats.xg * 0.3;
      r -= stats.goalsConceded * (pos === 'GK' ? 0.3 : pos === 'DF' ? 0.18 : 0.05);
      if (clean && (pos === 'GK' || pos === 'DF')) r += pos === 'GK' ? 0.8 : 0.5;
      r -= stats.yellow * 0.3;
      r -= stats.red * 1.5;
      r -= errors * 0.7;
      r -= bigMisses * 0.2;
      if (t.won) r += 0.3;
      if (t.lost) r -= 0.2;
      r += rng.gaussian(0, 0.2);
      out.push({
        ...stats,
        xg: Math.round(stats.xg * 100) / 100,
        cleanSheet: clean && (pos === 'GK' || pos === 'DF'),
        rating: Math.round(Math.max(4, Math.min(10, r)) * 10) / 10,
      });
    }
  }
  return out;
}
