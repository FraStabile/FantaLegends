import type { CommentaryTone } from '../domain/types';

/**
 * A commentary template library for one tone.
 *
 * Keys are either a match event type (`goal`, `save`, …), a refined variant
 * `type:detail` (`goal:header`, `save:one_on_one`, …) that the engine prefers when
 * available, or a situational tail (`tail:equalizer`, …) appended after the main line.
 *
 * Placeholders:
 *   {p}     main actor (scorer, shooter, dribbler, fouler…)
 *   {o}     secondary actor (assist man, goalkeeper, tackled/fouled player…)
 *   {t}     team of the main actor
 *   {opp}   opposing team
 *   {score} current score "2-1" (home-away)
 *   {min}   minute
 *   {home}  home team name, {away} away team name
 */
export type TemplateLibrary = Record<string, string[]>;

export type CommentaryTemplates = Record<CommentaryTone, TemplateLibrary>;

/** Every key the engine may request. A tone must provide all keys without ':'; refined keys are optional. */
export const COMMENTARY_KEYS = [
  'kickoff',
  'halftime',
  'fulltime:win',
  'fulltime:draw',
  'pass',
  'dribble',
  'tackle',
  'interception',
  'chance',
  'chance:through_ball',
  'chance:cross',
  'chance:cutback',
  'big_chance',
  'counter',
  'shot',
  'shot:long_shot',
  'shot:header',
  'save',
  'save:header',
  'save:long_shot',
  'save:one_on_one',
  'post',
  'crossbar',
  'miss',
  'miss:header',
  'miss:long_shot',
  'blocked',
  'corner',
  'foul',
  'yellow',
  'red',
  'penalty_awarded',
  'penalty_scored',
  'penalty_missed',
  'penalty_missed:saved',
  'goal',
  'goal:header',
  'goal:long_shot',
  'goal:one_on_one',
  'goal:free_kick',
  'goal:volley',
  'goal:solo',
  'goal:counter',
  'own_goal',
  'defensive_error',
  'injury',
  'shootout_start',
  'shootout_kick:scored',
  'shootout_kick:missed',
  'tail:equalizer',
  'tail:go_ahead',
  'tail:late',
  'tail:brace',
  'tail:hattrick',
  'tail:comeback',
] as const;

export type CommentaryKey = (typeof COMMENTARY_KEYS)[number];
