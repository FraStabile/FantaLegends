import type { Coach, CoachModifiers } from '../domain/types';
import { NO_COACH_MODIFIERS, TACTICS, type TacticProfile } from './tactics';

/** Multipliers applied to a side's zone ratings and game flow. */
export interface SideMultipliers {
  attack: number;
  midfield: number;
  defense: number;
  tempo: number;
  pressing: number;
  counter: number;
  control: number;
}

/** 1 modifier point ≈ 0.8% on the related zone. */
const K = 0.008;

/**
 * Static effect of the coach + tactic, independent of the score.
 * Coach overall adds a small general bonus (a great coach squeezes more out of any squad).
 */
export function baseMultipliers(coach: Coach | null): SideMultipliers {
  const m: CoachModifiers = coach?.modifiers ?? NO_COACH_MODIFIERS;
  const t: TacticProfile = TACTICS[coach?.preferredTactic ?? 'balanced'];
  const quality = coach ? 1 + (coach.overall - 85) * 0.002 : 0.98;
  return {
    attack: quality * (1 + m.attack * K),
    midfield: quality * (1 + (m.possession * 0.6 + m.passing * 0.4) * K),
    defense: quality * (1 + m.defense * K) * t.shape,
    tempo: t.tempo,
    pressing: t.pressing * (1 + m.pressing * 0.015),
    counter: t.counter * (1 + m.counter * 0.02),
    control: t.control * (1 + m.possession * 0.01),
  };
}

/**
 * Game-state management: how the coach reacts to being ahead or behind.
 * `goalDiff` is from the side's perspective.
 */
export function situationalMultipliers(coach: Coach | null, goalDiff: number, minute: number): SideMultipliers {
  const m: CoachModifiers = coach?.modifiers ?? NO_COACH_MODIFIERS;
  const late = minute > 70 ? (minute - 70) / 200 : 0; // up to +0.1 at 90'
  const neutral: SideMultipliers = { attack: 1, midfield: 1, defense: 1, tempo: 1, pressing: 1, counter: 1, control: 1 };
  if (goalDiff > 0) {
    // protecting a lead: good managers lock the game down, poor ones get nervous
    return {
      ...neutral,
      attack: 0.95 + m.leadManagement * 0.002,
      defense: 1 + 0.02 + m.leadManagement * K + late * 0.3,
      tempo: 0.93 - late * 0.5,
      counter: 1.08,
      control: 1 + m.leadManagement * 0.004,
    };
  }
  if (goalDiff < 0) {
    const push = 0.03 + m.deficitManagement * K + late * (1 + Math.abs(goalDiff) * 0.3);
    return {
      ...neutral,
      attack: 1 + push,
      defense: 1 - 0.03 - late * 0.6,
      tempo: 1.04 + late,
      pressing: 1.05 + late,
    };
  }
  return neutral;
}

export function combine(a: SideMultipliers, b: SideMultipliers): SideMultipliers {
  return {
    attack: a.attack * b.attack,
    midfield: a.midfield * b.midfield,
    defense: a.defense * b.defense,
    tempo: a.tempo * b.tempo,
    pressing: a.pressing * b.pressing,
    counter: a.counter * b.counter,
    control: a.control * b.control,
  };
}

/** Morale swing after a goal, amplified by the coach's motivation. */
export function moraleSwing(coach: Coach | null, scored: boolean): number {
  const motivation = (coach?.modifiers ?? NO_COACH_MODIFIERS).motivation;
  return scored ? 0.07 * (1 + motivation / 12) : -0.05 * (1 - motivation / 25);
}
