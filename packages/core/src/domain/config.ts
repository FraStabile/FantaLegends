import { z } from 'zod';
import type { LeagueConfig, RosterRequirements, Slot } from './types';
import { DomainError } from './errors';

export const DEFAULT_ROSTER: RosterRequirements = { GK: 1, DF: 1, MF: 1, FW: 2, coach: true };

export const DEFAULT_CONFIG: LeagueConfig = {
  name: 'La mia lega',
  maxParticipants: 6,
  startingCredits: 20,
  format: 'double_round_robin',
  roster: DEFAULT_ROSTER,
  bidTimerSeconds: 10,
  openingTimerSeconds: 15,
  minIncrement: 1,
  minPrice: 1,
  unsoldPolicy: 'discard',
  homeAway: true,
  playoffs: true,
  playoffTeams: 4,
  poolPreset: 'MIXED',
  poolSets: [],
  poolExtraRatio: 0.6,
  commentaryTone: 'epico',
  liveMatchSeconds: 150,
  visibility: { othersCredits: true, othersRosters: true, bidderNames: true },
  customRules: '',
};

const rosterSchema = z.object({
  GK: z.number().int().min(0).max(3),
  DF: z.number().int().min(0).max(6),
  MF: z.number().int().min(0).max(6),
  FW: z.number().int().min(0).max(6),
  coach: z.boolean(),
});

export const leagueConfigSchema = z.object({
  name: z.string().trim().min(2).max(40),
  maxParticipants: z.number().int().min(2).max(12),
  startingCredits: z.number().int().min(5).max(2000),
  format: z.enum(['round_robin', 'double_round_robin', 'groups_knockout', 'knockout']),
  roster: rosterSchema,
  bidTimerSeconds: z.number().int().min(3).max(60),
  openingTimerSeconds: z.number().int().min(5).max(120),
  minIncrement: z.number().int().min(1).max(50),
  minPrice: z.number().int().min(1).max(20),
  unsoldPolicy: z.enum(['discard', 'requeue']),
  homeAway: z.boolean(),
  playoffs: z.boolean(),
  playoffTeams: z.union([z.literal(2), z.literal(4)]),
  poolPreset: z.enum(['LEGENDS', 'MODERN', 'MIXED', 'RANDOM', 'CUSTOM']),
  poolSets: z.array(z.string().max(30)).max(10),
  poolExtraRatio: z.number().min(0).max(3),
  commentaryTone: z.enum(['classico', 'epico', 'tecnico', 'ironico', 'trash', 'bar_sport']),
  liveMatchSeconds: z.number().int().min(20).max(900),
  visibility: z.object({ othersCredits: z.boolean(), othersRosters: z.boolean(), bidderNames: z.boolean() }),
  customRules: z.string().max(500),
});

export type LeagueConfigInput = Partial<Omit<LeagueConfig, 'roster' | 'visibility'>> & {
  roster?: Partial<RosterRequirements>;
  visibility?: Partial<LeagueConfig['visibility']>;
};

/** Merge a partial input onto a base config and validate the result (server side). */
export function resolveConfig(input: LeagueConfigInput, base: LeagueConfig = DEFAULT_CONFIG): LeagueConfig {
  const merged = {
    ...base,
    ...input,
    // leagues created before the option existed have no policy stored
    unsoldPolicy: input.unsoldPolicy ?? base.unsoldPolicy ?? DEFAULT_CONFIG.unsoldPolicy,
    roster: { ...base.roster, ...(input.roster ?? {}) },
    visibility: { ...base.visibility, ...(input.visibility ?? {}) },
  };
  const parsed = leagueConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new DomainError('INVALID_CONFIG', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const cfg = parsed.data as LeagueConfig;
  const slots = totalSlots(cfg);
  if (cfg.roster.GK + cfg.roster.DF + cfg.roster.MF + cfg.roster.FW < 2) {
    throw new DomainError('INVALID_CONFIG', 'La rosa deve avere almeno 2 giocatori');
  }
  if (cfg.roster.GK < 1) throw new DomainError('INVALID_CONFIG', 'Serve almeno un portiere');
  if (slots * cfg.minPrice > cfg.startingCredits) {
    throw new DomainError('INVALID_CONFIG', 'Crediti iniziali insufficienti per completare la rosa al prezzo minimo');
  }
  if (cfg.format === 'groups_knockout' && cfg.maxParticipants < 4) {
    throw new DomainError('INVALID_CONFIG', 'Il formato a gironi richiede almeno 4 partecipanti');
  }
  return cfg;
}

/** Number of slots (players + coach) each team must fill. */
export function totalSlots(cfg: LeagueConfig): number {
  const r = cfg.roster;
  return r.GK + r.DF + r.MF + r.FW + (r.coach ? 1 : 0);
}

export function slotRequirement(cfg: LeagueConfig, slot: Slot): number {
  if (slot === 'COACH') return cfg.roster.coach ? 1 : 0;
  return cfg.roster[slot];
}

export const SLOTS: readonly Slot[] = ['GK', 'DF', 'MF', 'FW', 'COACH'];

export const SLOT_LABELS_IT: Record<Slot, string> = {
  GK: 'Portiere',
  DF: 'Difensore',
  MF: 'Centrocampista',
  FW: 'Attaccante',
  COACH: 'Allenatore',
};
