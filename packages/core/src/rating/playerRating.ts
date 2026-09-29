import type { Player, PlayerStats, Position } from '../domain/types';

/**
 * PlayerRating — derives ratings from individual attributes.
 *
 * `positionalOverall` is the canonical formula used to (a) sanity check the seed
 * database, (b) assign an overall to custom / AI generated players whose overall
 * is missing or inconsistent. Zone values are what the match engine actually uses:
 * the overall is never used directly to decide a match.
 */

type Weights = Partial<Record<keyof PlayerStats, number>>;

const OVERALL_WEIGHTS: Record<Position, Weights> = {
  GK: { diving: 0.24, handling: 0.22, reflexes: 0.26, positioning: 0.2, kicking: 0.05, composure: 0.03 },
  DF: {
    defending: 0.18, marking: 0.14, tackling: 0.14, positioning: 0.1, strength: 0.08, heading: 0.08,
    pace: 0.08, passing: 0.08, composure: 0.06, stamina: 0.06,
  },
  MF: {
    passing: 0.18, vision: 0.14, ballControl: 0.12, dribbling: 0.1, composure: 0.08, stamina: 0.08,
    shooting: 0.07, longShots: 0.06, defending: 0.07, tackling: 0.05, pace: 0.05,
  },
  FW: {
    finishing: 0.2, shooting: 0.12, positioning: 0.12, dribbling: 0.12, ballControl: 0.08, pace: 0.1,
    acceleration: 0.06, composure: 0.1, heading: 0.05, passing: 0.05,
  },
};

function weighted(stats: PlayerStats, w: Weights): number {
  let sum = 0;
  let tot = 0;
  for (const [k, v] of Object.entries(w) as [keyof PlayerStats, number][]) {
    sum += stats[k] * v;
    tot += v;
  }
  return sum / tot;
}

export function positionalOverall(position: Position, stats: PlayerStats): number {
  const raw = weighted(stats, OVERALL_WEIGHTS[position]);
  // stretch slightly: elite attributes in a few areas make world-class players
  return Math.max(40, Math.min(99, Math.round(raw * 1.02 + 1)));
}

/** Contribution of a player to each zone of the pitch (0–99 scale, before position weighting). */
export interface ZoneValues {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeping: number;
}

export function zoneValues(s: PlayerStats): ZoneValues {
  return {
    attack: weighted(s, { finishing: 0.26, shooting: 0.1, dribbling: 0.16, pace: 0.12, acceleration: 0.06, positioning: 0.14, composure: 0.12, heading: 0.04 }),
    midfield: weighted(s, { passing: 0.28, vision: 0.2, ballControl: 0.18, dribbling: 0.1, composure: 0.1, stamina: 0.08, strength: 0.06 }),
    defense: weighted(s, { defending: 0.2, marking: 0.18, tackling: 0.18, positioning: 0.12, strength: 0.1, pace: 0.1, heading: 0.06, aggression: 0.06 }),
    goalkeeping: weighted(s, { diving: 0.28, reflexes: 0.3, handling: 0.22, positioning: 0.2 }),
  };
}

/** How much each position contributes to each zone. */
export const POSITION_ZONE_WEIGHTS: Record<Position, { attack: number; midfield: number; defense: number }> = {
  GK: { attack: 0, midfield: 0.08, defense: 0.12 },
  DF: { attack: 0.12, midfield: 0.35, defense: 1 },
  MF: { attack: 0.45, midfield: 1, defense: 0.45 },
  FW: { attack: 1, midfield: 0.3, defense: 0.1 },
};

/** Grouped attributes shown in the player card (technical / physical / mental). */
export function attributeGroups(p: Player): { label: string; items: { label: string; value: number }[] }[] {
  const s = p.stats;
  if (p.position === 'GK') {
    return [
      { label: 'Portiere', items: [
        { label: 'Tuffo', value: s.diving }, { label: 'Presa', value: s.handling },
        { label: 'Riflessi', value: s.reflexes }, { label: 'Rinvio', value: s.kicking },
        { label: 'Piazzamento', value: s.positioning },
      ] },
      { label: 'Fisico', items: [{ label: 'Velocità', value: s.pace }, { label: 'Forza', value: s.strength }] },
      { label: 'Mentale', items: [{ label: 'Freddezza', value: s.composure }, { label: 'Visione', value: s.vision }] },
    ];
  }
  return [
    { label: 'Tecnica', items: [
      { label: 'Tiro', value: s.shooting }, { label: 'Finalizzazione', value: s.finishing },
      { label: 'Passaggio', value: s.passing }, { label: 'Dribbling', value: s.dribbling },
      { label: 'Controllo', value: s.ballControl }, { label: 'Cross', value: s.crossing },
      { label: 'Colpo di testa', value: s.heading }, { label: 'Tiro da fuori', value: s.longShots },
      { label: 'Punizioni', value: s.freeKick }, { label: 'Rigori', value: s.penalty },
    ] },
    { label: 'Fisico', items: [
      { label: 'Velocità', value: s.pace }, { label: 'Accelerazione', value: s.acceleration },
      { label: 'Resistenza', value: s.stamina }, { label: 'Forza', value: s.strength },
      { label: 'Fisicità', value: s.physical },
    ] },
    { label: 'Difesa', items: [
      { label: 'Difesa', value: s.defending }, { label: 'Marcatura', value: s.marking },
      { label: 'Contrasto', value: s.tackling }, { label: 'Aggressività', value: s.aggression },
    ] },
    { label: 'Mentale', items: [
      { label: 'Visione', value: s.vision }, { label: 'Freddezza', value: s.composure },
      { label: 'Posizione', value: s.positioning },
    ] },
  ];
}
