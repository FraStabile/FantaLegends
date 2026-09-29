import type { Coach, CoachModifiers, Player, Tactic } from '../domain/types';

/** How a tactic shapes the flow of the game. All values are multipliers around 1. */
export interface TacticProfile {
  label: string;
  /** frequency of attacking actions */
  tempo: number;
  /** tendency to keep the ball (feeds possession share) */
  control: number;
  /** turnover pressure on the opponent, costs stamina */
  pressing: number;
  /** probability of fast breaks after winning the ball */
  counter: number;
  /** defensive solidity */
  shape: number;
  /** share of long shots / crosses vs. combination play */
  directness: number;
}

export const TACTICS: Record<Tactic, TacticProfile> = {
  possession: { label: 'Possesso palla', tempo: 1.0, control: 1.14, pressing: 1.02, counter: 0.8, shape: 1.0, directness: 0.75 },
  gegenpress: { label: 'Gegenpressing', tempo: 1.12, control: 1.02, pressing: 1.25, counter: 1.15, shape: 0.94, directness: 0.95 },
  counter: { label: 'Contropiede', tempo: 0.92, control: 0.88, pressing: 0.92, counter: 1.35, shape: 1.08, directness: 1.1 },
  catenaccio: { label: 'Catenaccio', tempo: 0.84, control: 0.86, pressing: 0.85, counter: 1.2, shape: 1.18, directness: 1.05 },
  balanced: { label: 'Equilibrato', tempo: 1.0, control: 1.0, pressing: 1.0, counter: 1.0, shape: 1.02, directness: 1.0 },
  direct: { label: 'Verticale', tempo: 1.08, control: 0.92, pressing: 1.05, counter: 1.1, shape: 0.98, directness: 1.35 },
  total_football: { label: 'Calcio totale', tempo: 1.12, control: 1.1, pressing: 1.12, counter: 1.0, shape: 0.92, directness: 0.85 },
};

export const NO_COACH_MODIFIERS: CoachModifiers = {
  possession: -2, passing: -2, pressing: -2, defense: -2, counter: -2, attack: -2,
  leadManagement: -3, deficitManagement: -3, adaptability: 0, motivation: -2,
};

/**
 * How well the squad fits the coach's preferred tactic, 0 (poor) … 1 (perfect).
 * A possession coach wants passers, a gegenpress coach wants runners, etc.
 */
export function tacticFit(tactic: Tactic, players: Player[]): number {
  if (players.length === 0) return 0.5;
  const avg = (f: (p: Player) => number) => players.reduce((s, p) => s + f(p), 0) / players.length;
  const demand: Record<Tactic, number> = {
    possession: avg((p) => (p.stats.passing + p.stats.ballControl + p.stats.vision) / 3),
    gegenpress: avg((p) => (p.stats.stamina + p.stats.pace + p.stats.aggression) / 3),
    counter: avg((p) => (p.stats.pace + p.stats.acceleration + p.stats.finishing) / 3),
    catenaccio: avg((p) => (p.stats.defending + p.stats.marking + p.stats.composure) / 3),
    balanced: 72,
    direct: avg((p) => (p.stats.strength + p.stats.heading + p.stats.longShots) / 3),
    total_football: avg((p) => (p.stats.passing + p.stats.stamina + p.stats.dribbling + p.stats.defending) / 4),
  };
  return Math.max(0, Math.min(1, (demand[tactic] - 50) / 35));
}

/**
 * Multiplier (≈0.94–1.02) applied to the team when the squad does not match the
 * tactic. Adaptability reduces the malus.
 */
export function tacticFitMultiplier(coach: Coach | null, players: Player[]): number {
  if (!coach) return 0.97;
  const fit = tacticFit(coach.preferredTactic, players);
  const malus = (1 - fit) * 0.07 * (1 - Math.max(0, coach.modifiers.adaptability) / 15);
  return 1.02 - malus;
}

export function formationLabel(players: Player[]): string {
  const count = (pos: string) => players.filter((p) => p.position === pos).length;
  return [count('DF'), count('MF'), count('FW')].join('-');
}
