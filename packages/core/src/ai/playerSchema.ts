import { z } from 'zod';
import type { CatalogItem, Coach, Era, Player, PlayerStats, PlayStyle, Position, Tactic } from '../domain/types';
import { baseValueFor, rarityFor, slugify } from '../catalog/expand';
import { positionalOverall } from '../rating/playerRating';
import { hashString } from '../util/rng';

/**
 * Structured output contract for the AI player generator.
 *
 * The LLM only proposes *data*; this module validates it, clamps every number,
 * re-derives rarity / auction value and checks that the overall is coherent
 * with the individual stats. The match engine never trusts the LLM directly.
 */

const stat = z.number().min(1).max(99);

export const PLAY_STYLES: PlayStyle[] = [
  'shot_stopper', 'sweeper_keeper', 'stopper', 'ball_playing_defender', 'libero', 'wingback', 'regista', 'box_to_box',
  'ball_winner', 'playmaker', 'trequartista', 'winger', 'poacher', 'target_man', 'complete_forward', 'false_nine',
  'inside_forward', 'speedster',
];

export const aiPlayerSchema = z.object({
  name: z.string().min(2).max(60),
  nationality: z.string().min(2).max(3),
  position: z.enum(['GK', 'DF', 'MF', 'FW']),
  primePeriod: z.string().regex(/^\d{4}-\d{4}$/),
  historicalClub: z.string().min(1).max(60),
  overall: z.number().min(40).max(99),
  playStyle: z.enum(PLAY_STYLES as [PlayStyle, ...PlayStyle[]]),
  foot: z.enum(['L', 'R', 'B']),
  heightCm: z.number().min(150).max(210),
  weakFoot: z.number().min(1).max(5),
  skillMoves: z.number().min(1).max(5),
  tags: z.array(z.string().max(20)).max(8),
  stats: z.object({
    pace: stat, acceleration: stat, shooting: stat, passing: stat, dribbling: stat, ballControl: stat,
    physical: stat, stamina: stat, strength: stat, defending: stat, marking: stat, tackling: stat,
    positioning: stat, vision: stat, composure: stat, finishing: stat, heading: stat, longShots: stat,
    crossing: stat, freeKick: stat, penalty: stat, aggression: stat, diving: stat, handling: stat,
    reflexes: stat, kicking: stat,
  }),
});

export const aiCoachSchema = z.object({
  name: z.string().min(2).max(60),
  nationality: z.string().min(2).max(3),
  primePeriod: z.string().regex(/^\d{4}-\d{4}$/),
  overall: z.number().min(50).max(99),
  style: z.string().min(2).max(140),
  preferredTactic: z.enum(['possession', 'gegenpress', 'counter', 'catenaccio', 'balanced', 'direct', 'total_football']),
  modifiers: z.object({
    possession: z.number(), passing: z.number(), pressing: z.number(), defense: z.number(), counter: z.number(),
    attack: z.number(), leadManagement: z.number(), deficitManagement: z.number(), adaptability: z.number(), motivation: z.number(),
  }),
  tags: z.array(z.string().max(20)).max(8),
});

export const aiGenerationSchema = z.object({
  players: z.array(aiPlayerSchema).max(80),
  coaches: z.array(aiCoachSchema).max(30).default([]),
});

export type AiPlayer = z.infer<typeof aiPlayerSchema>;
export type AiCoach = z.infer<typeof aiCoachSchema>;

export function eraFromPrime(prime: string): Era {
  const start = Number(prime.slice(0, 4));
  if (start < 1980) return '70s';
  if (start < 1990) return '80s';
  if (start < 2000) return '90s';
  if (start < 2010) return '2000s';
  if (start < 2020) return '2010s';
  return '2020s';
}

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/**
 * Turn a validated AI player into a catalog Player. If the declared overall is
 * far from what the stats justify (±6), the stats win.
 */
export function normalizeAiPlayer(p: AiPlayer, source: 'ai' | 'custom', salt: string): Player {
  const stats = Object.fromEntries(Object.entries(p.stats).map(([k, v]) => [k, clampInt(v, 1, 99)])) as unknown as PlayerStats;
  const computed = positionalOverall(p.position as Position, stats);
  const declared = clampInt(p.overall, 40, 99);
  const overall = Math.abs(declared - computed) > 6 ? computed : declared;
  return {
    id: `${source === 'ai' ? 'ai' : 'cu'}-${slugify(p.name)}-${(hashString(salt + p.name) % 46656).toString(36)}`,
    kind: 'player',
    name: p.name.trim(),
    nationality: p.nationality.toUpperCase(),
    position: p.position,
    primePeriod: p.primePeriod,
    overall,
    stats,
    playStyle: p.playStyle,
    foot: p.foot,
    heightCm: clampInt(p.heightCm, 150, 210),
    weakFoot: clampInt(p.weakFoot, 1, 5),
    skillMoves: clampInt(p.skillMoves, 1, 5),
    rarity: rarityFor(overall),
    baseAuctionValue: baseValueFor(overall),
    tags: [...new Set([...p.tags.map((t) => t.toLowerCase()), source])],
    historicalClub: p.historicalClub,
    era: eraFromPrime(p.primePeriod),
    source,
  };
}

export function normalizeAiCoach(c: AiCoach, source: 'ai' | 'custom', salt: string): Coach {
  const m = Object.fromEntries(Object.entries(c.modifiers).map(([k, v]) => [k, clampInt(v, -8, 12)])) as unknown as Coach['modifiers'];
  const overall = clampInt(c.overall, 50, 99);
  return {
    id: `${source === 'ai' ? 'ai' : 'cu'}-c-${slugify(c.name)}-${(hashString(salt + c.name) % 46656).toString(36)}`,
    kind: 'coach',
    name: c.name.trim(),
    nationality: c.nationality.toUpperCase(),
    primePeriod: c.primePeriod,
    overall,
    style: c.style,
    preferredTactic: c.preferredTactic as Tactic,
    modifiers: m,
    rarity: rarityFor(overall),
    baseAuctionValue: baseValueFor(overall, 'coach'),
    tags: [...new Set([...c.tags.map((t) => t.toLowerCase()), source])],
    era: eraFromPrime(c.primePeriod),
    source,
  };
}

/** Parse + normalise a raw LLM JSON answer. Invalid entries are dropped, not fatal. */
export function parseAiGeneration(raw: unknown, salt: string): { items: CatalogItem[]; rejected: number } {
  const root = z.object({ players: z.array(z.unknown()).default([]), coaches: z.array(z.unknown()).default([]) }).safeParse(raw);
  if (!root.success) return { items: [], rejected: 0 };
  const items: CatalogItem[] = [];
  let rejected = 0;
  for (const p of root.data.players) {
    const r = aiPlayerSchema.safeParse(p);
    if (r.success) items.push(normalizeAiPlayer(r.data, 'ai', salt));
    else rejected++;
  }
  for (const c of root.data.coaches) {
    const r = aiCoachSchema.safeParse(c);
    if (r.success) items.push(normalizeAiCoach(r.data, 'ai', salt));
    else rejected++;
  }
  // de-duplicate by id
  const seen = new Set<string>();
  return { items: items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true))), rejected };
}
