import type { CoachModifiers, Era, Foot, PlayStyle, Position, Tactic } from '../domain/types';

/**
 * Compact authoring format for the seed database.
 *
 * Authors write the six "face" attributes plus a handful of signature overrides;
 * `expandSeedPlayer` derives the full detailed stat sheet deterministically,
 * shaping it with the play style (a poacher finishes better than he shoots from
 * range, a target man heads better than he sprints, …).
 */
export interface SeedPlayer {
  /** full name as displayed */
  n: string;
  /** FIFA-style 3 letter nationality code (ARG, BRA, ITA…) */
  nat: string;
  pos: Position;
  /** prime period, e.g. "2011-2012" */
  prime: string;
  /** club where the prime was played */
  club: string;
  era: Era;
  foot: Foot;
  /** height in cm */
  h: number;
  style: PlayStyle;
  /** overall in the prime (40–99) */
  ovr: number;
  /**
   * Face attributes.
   * Outfield: [pace, shooting, passing, dribbling, defending, physical]
   * Goalkeeper: [diving, handling, kicking, reflexes, speed, positioning]
   */
  f: [number, number, number, number, number, number];
  /** optional signature overrides of detailed stats */
  x?: Partial<Record<SeedStatOverride, number>>;
  /** weak foot 1–5 (default 3) */
  wf?: number;
  /** skill moves 1–5 (default by style) */
  sm?: number;
  /** thematic tags: 'legend', 'modern', 'world_cup', 'serie_a', 'champions', 'balon_dor', '90s', '2000s', … */
  tags: string[];
}

export type SeedStatOverride =
  | 'fin' // finishing
  | 'hea' // heading
  | 'lon' // long shots
  | 'cro' // crossing
  | 'fk' // free kick
  | 'pen' // penalty
  | 'vis' // vision
  | 'com' // composure
  | 'sta' // stamina
  | 'str' // strength
  | 'acc' // acceleration
  | 'tac' // tackling
  | 'mar' // marking
  | 'agg'; // aggression

export interface SeedCoach {
  n: string;
  nat: string;
  /** prime period, e.g. "2008-2012" */
  prime: string;
  era: Era;
  ovr: number;
  /** one-line Italian description of the style */
  style: string;
  tactic: Tactic;
  m: CoachModifiers;
  tags: string[];
}
