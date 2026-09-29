import { z } from 'zod';
import type { Player, PlayStyle, Position } from '../domain/types';
import { expandSeedPlayer, slugify } from './expand';
import type { SeedPlayer } from './seedTypes';
import { eraFromPrime, PLAY_STYLES } from '../ai/playerSchema';
import { hashString } from '../util/rng';

/** What the Master fills in the "Aggiungi giocatore" form. Face stats are optional. */
export const customPlayerSchema = z.object({
  name: z.string().trim().min(2).max(40),
  nationality: z.string().trim().min(2).max(3).default('ITA'),
  position: z.enum(['GK', 'DF', 'MF', 'FW']),
  primePeriod: z.string().regex(/^\d{4}-\d{4}$/).default('2020-2024'),
  historicalClub: z.string().trim().max(40).default('Amatori'),
  overall: z.number().int().min(40).max(99),
  playStyle: z.enum(PLAY_STYLES as [PlayStyle, ...PlayStyle[]]).optional(),
  foot: z.enum(['L', 'R', 'B']).default('R'),
  heightCm: z.number().int().min(150).max(210).default(180),
  face: z.array(z.number().int().min(1).max(99)).length(6).optional(),
});
export type CustomPlayerInput = z.input<typeof customPlayerSchema>;

const DEFAULT_STYLE: Record<Position, PlayStyle> = { GK: 'shot_stopper', DF: 'stopper', MF: 'box_to_box', FW: 'complete_forward' };

/**
 * Face stats profile per role, expressed as offsets from the overall, so a
 * custom 72 striker has a striker's shape (fast, good finisher, poor defender).
 */
const FACE_OFFSETS: Record<Position, [number, number, number, number, number, number]> = {
  GK: [0, -1, -8, 1, -30, 0],
  DF: [-6, -30, -10, -14, 1, 0],
  MF: [-6, -6, 2, 0, -12, -6],
  FW: [2, 1, -10, -2, -45, -8],
};

export function createCustomPlayer(input: CustomPlayerInput): Player {
  const p = customPlayerSchema.parse(input);
  const face = (p.face ?? FACE_OFFSETS[p.position].map((o) => p.overall + o)).map((v) => Math.max(10, Math.min(99, v))) as SeedPlayer['f'];
  const seed: SeedPlayer = {
    n: p.name,
    nat: p.nationality.toUpperCase(),
    pos: p.position,
    prime: p.primePeriod,
    club: p.historicalClub,
    era: eraFromPrime(p.primePeriod),
    foot: p.foot,
    h: p.heightCm,
    style: p.playStyle ?? DEFAULT_STYLE[p.position],
    ovr: p.overall,
    f: face,
    tags: ['custom'],
  };
  const player = expandSeedPlayer(seed);
  return { ...player, id: `cu-${slugify(p.name)}-${(hashString(JSON.stringify(p)) % 46656).toString(36)}`, source: 'custom' };
}
