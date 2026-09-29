import type { Coach, Player, TeamStrengthView } from '../domain/types';
import { POSITION_ZONE_WEIGHTS, zoneValues } from '../rating/playerRating';
import { baseMultipliers } from './coachModifiers';
import { tacticFitMultiplier } from './tactics';

export interface ZoneRatings {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeping: number;
}

export interface StrengthPlayer {
  player: Player;
  /** 0–1: fatigue and injuries reduce the player's effective contribution */
  condition: number;
  active: boolean;
}

/**
 * Zone ratings of a lineup. Each player contributes to attack/midfield/defense
 * according to his position; the sum is normalised by the weight of the full
 * starting lineup, so a sent-off player really weakens the team.
 */
export function zoneRatings(lineup: StrengthPlayer[]): ZoneRatings {
  let atk = 0, mid = 0, def = 0, gk = 0;
  let wAtk = 0, wMid = 0, wDef = 0;
  let hasKeeper = false;
  for (const { player, condition, active } of lineup) {
    const w = POSITION_ZONE_WEIGHTS[player.position];
    wAtk += w.attack;
    wMid += w.midfield;
    wDef += w.defense;
    if (!active) continue;
    const z = zoneValues(player.stats);
    atk += w.attack * z.attack * condition;
    mid += w.midfield * z.midfield * condition;
    def += w.defense * z.defense * condition;
    if (player.position === 'GK' && !hasKeeper) {
      gk = z.goalkeeping * (0.9 + condition * 0.1);
      hasKeeper = true;
    }
  }
  if (!hasKeeper) {
    // an outfield player goes in goal
    gk = 35;
  }
  return {
    attack: wAtk ? atk / wAtk : 30,
    midfield: wMid ? mid / wMid : 30,
    defense: wDef ? def / wDef : 30,
    goalkeeping: gk,
  };
}

/** Pre-match strength summary shown in the UI (coach and tactic fit included). */
export function strengthView(players: Player[], coach: Coach | null): TeamStrengthView {
  const z = zoneRatings(players.map((player) => ({ player, condition: 1, active: true })));
  const m = baseMultipliers(coach);
  const fit = tacticFitMultiplier(coach, players);
  const attack = Math.round(z.attack * m.attack * fit);
  const midfield = Math.round(z.midfield * m.midfield * fit);
  const defense = Math.round(z.defense * m.defense * fit);
  const goalkeeper = Math.round(z.goalkeeping);
  const overall = Math.round(attack * 0.3 + midfield * 0.25 + defense * 0.25 + goalkeeper * 0.2);
  return { overall, attack, midfield, defense, goalkeeper };
}
