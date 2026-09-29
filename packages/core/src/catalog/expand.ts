import type { Coach, Player, PlayerStats, PlayStyle, Rarity } from '../domain/types';
import type { SeedCoach, SeedPlayer, SeedStatOverride } from './seedTypes';
import { hashString } from '../util/rng';

const clamp = (v: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, Math.round(v)));

/** Small deterministic jitter (−spread…+spread) so derived stats are not all identical. */
function jitter(seed: string, key: string, spread: number): number {
  const h = hashString(`${seed}:${key}`);
  return (h % (spread * 2 + 1)) - spread;
}

/** Play-style shaping of derived stats (added on top of the base derivation). */
const STYLE_SHAPES: Partial<Record<PlayStyle, Partial<Record<keyof PlayerStats, number>>>> = {
  poacher: { finishing: 5, positioning: 6, longShots: -6, vision: -6, heading: 2, composure: 3 },
  target_man: { heading: 10, strength: 8, pace: -4, acceleration: -6, finishing: 2, dribbling: -3 },
  complete_forward: { finishing: 3, heading: 3, longShots: 3, strength: 3 },
  false_nine: { vision: 6, ballControl: 4, heading: -8, positioning: 2, strength: -4 },
  inside_forward: { finishing: 2, longShots: 4, acceleration: 3, crossing: -2 },
  speedster: { acceleration: 6, pace: 3, composure: -3, strength: -3 },
  winger: { crossing: 8, acceleration: 4, finishing: -4, heading: -4 },
  trequartista: { vision: 7, ballControl: 5, longShots: 3, freeKick: 4, stamina: -5 },
  playmaker: { vision: 8, crossing: 3, longShots: 3, freeKick: 3 },
  regista: { vision: 9, longShots: 3, freeKick: 5, pace: -4, acceleration: -4, composure: 5 },
  box_to_box: { stamina: 9, strength: 3, longShots: 2, tackling: 3 },
  ball_winner: { tackling: 8, aggression: 10, marking: 5, stamina: 5, vision: -5 },
  stopper: { marking: 5, tackling: 5, strength: 5, heading: 6, aggression: 6, passing: -3 },
  ball_playing_defender: { vision: 6, composure: 6, passing: 4 },
  libero: { vision: 7, composure: 8, positioning: 6, marking: 3 },
  wingback: { crossing: 10, stamina: 8, acceleration: 4, heading: -4 },
  shot_stopper: { reflexes: 3, diving: 2, kicking: -4 },
  sweeper_keeper: { kicking: 5, pace: 10, composure: 4 },
};

const DEFAULT_SKILL_MOVES: Partial<Record<PlayStyle, number>> = {
  false_nine: 5,
  inside_forward: 4,
  winger: 4,
  trequartista: 4,
  playmaker: 4,
  complete_forward: 4,
  speedster: 4,
  poacher: 3,
  target_man: 2,
  regista: 3,
  box_to_box: 3,
  ball_winner: 2,
  stopper: 2,
  ball_playing_defender: 2,
  libero: 3,
  wingback: 3,
  shot_stopper: 1,
  sweeper_keeper: 1,
};

const OVERRIDE_KEYS: Record<SeedStatOverride, keyof PlayerStats> = {
  fin: 'finishing',
  hea: 'heading',
  lon: 'longShots',
  cro: 'crossing',
  fk: 'freeKick',
  pen: 'penalty',
  vis: 'vision',
  com: 'composure',
  sta: 'stamina',
  str: 'strength',
  acc: 'acceleration',
  tac: 'tackling',
  mar: 'marking',
  agg: 'aggression',
};

export function rarityFor(overall: number): Rarity {
  if (overall >= 92) return 'legendary';
  if (overall >= 87) return 'epic';
  if (overall >= 82) return 'rare';
  return 'common';
}

/**
 * Suggested auction value on a 100-credit economy: convex in the overall, so a 97
 * is worth far more than an 85. Used by bots as a reference price and shown to users.
 */
export function baseValueFor(overall: number, kind: 'player' | 'coach' = 'player'): number {
  const x = Math.max(0, overall - 70);
  const v = 1 + Math.pow(x, 1.9) / 14;
  return Math.max(1, Math.round(kind === 'coach' ? v * 0.7 : v));
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function derivePlayerStats(seed: SeedPlayer): PlayerStats {
  const key = seed.n;
  const j = (k: string, s = 3) => jitter(key, k, s);
  let stats: PlayerStats;

  if (seed.pos === 'GK') {
    const [div, han, kic, ref, spd, pos] = seed.f;
    stats = {
      pace: spd + j('pace'),
      acceleration: spd + j('acc'),
      shooting: 18 + j('sho', 6),
      passing: kic - 12 + j('pas'),
      dribbling: 22 + j('dri', 6),
      ballControl: 30 + j('bc', 6),
      physical: 60 + (seed.h - 185) + j('phy', 5),
      stamina: 45 + j('sta', 6),
      strength: 58 + (seed.h - 185) + j('str', 5),
      defending: 20 + j('def', 5),
      marking: 15 + j('mar', 5),
      tackling: 14 + j('tac', 5),
      positioning: pos,
      vision: kic - 18 + j('vis', 4),
      composure: Math.round((pos + ref) / 2) - 6 + j('com'),
      finishing: 14 + j('fin', 5),
      heading: 16 + j('hea', 5),
      longShots: 15 + j('lon', 5),
      crossing: 18 + j('cro', 5),
      freeKick: 18 + j('fk', 6),
      penalty: 25 + j('pen', 8),
      aggression: 35 + j('agg', 8),
      diving: div,
      handling: han,
      reflexes: ref,
      kicking: kic,
    };
  } else {
    const [pac, sho, pas, dri, def, phy] = seed.f;
    stats = {
      pace: pac + j('pace', 1),
      acceleration: pac + j('acc'),
      shooting: sho,
      passing: pas,
      dribbling: dri,
      ballControl: Math.round(dri * 0.7 + pas * 0.3) + j('bc'),
      physical: phy,
      stamina: Math.round(phy * 0.55 + 38) + j('sta', 4),
      strength: phy + j('str', 4),
      defending: def,
      marking: def + j('mar'),
      tackling: def + j('tac'),
      positioning:
        seed.pos === 'DF'
          ? def + j('pos')
          : seed.pos === 'FW'
            ? Math.round(sho * 0.8 + 16) + j('pos')
            : Math.round((sho + pas) / 2) + j('pos'),
      vision: Math.round(pas * 0.9 + (seed.pos === 'DF' ? 0 : 6)) + j('vis'),
      composure: Math.round((sho + pas + dri) / 3) + (seed.ovr - 80) / 3 + j('com'),
      finishing: sho + (seed.pos === 'FW' ? 2 : -3) + j('fin'),
      heading: Math.round(phy * 0.45 + (seed.h - 150) * 0.9) + (seed.pos === 'DF' || seed.pos === 'FW' ? 6 : 0) + j('hea', 4),
      longShots: sho - 3 + j('lon', 4),
      crossing: Math.round(pas * 0.85) + j('cro', 4),
      freeKick: Math.round((sho + pas) / 2) - 12 + j('fk', 8),
      penalty: Math.round(sho * 0.85 + 6) + j('pen', 4),
      aggression: Math.round(def * 0.55 + phy * 0.3) + j('agg', 6),
      diving: 9 + j('div', 3),
      handling: 9 + j('han', 3),
      reflexes: 9 + j('ref', 3),
      kicking: 10 + j('kic', 3),
    };
  }

  const shape = STYLE_SHAPES[seed.style];
  if (shape) {
    for (const [k, delta] of Object.entries(shape) as [keyof PlayerStats, number][]) {
      stats[k] += delta;
    }
  }
  if (seed.x) {
    for (const [k, v] of Object.entries(seed.x) as [SeedStatOverride, number][]) {
      stats[OVERRIDE_KEYS[k]] = v;
    }
  }
  for (const k of Object.keys(stats) as (keyof PlayerStats)[]) stats[k] = clamp(stats[k]);
  return stats;
}

export function expandSeedPlayer(seed: SeedPlayer): Player {
  return {
    id: `p-${slugify(seed.n)}`,
    kind: 'player',
    name: seed.n,
    nationality: seed.nat,
    position: seed.pos,
    primePeriod: seed.prime,
    overall: seed.ovr,
    stats: derivePlayerStats(seed),
    playStyle: seed.style,
    foot: seed.foot,
    heightCm: seed.h,
    weakFoot: seed.wf ?? 3,
    skillMoves: seed.sm ?? DEFAULT_SKILL_MOVES[seed.style] ?? 3,
    rarity: rarityFor(seed.ovr),
    baseAuctionValue: baseValueFor(seed.ovr),
    tags: seed.tags,
    historicalClub: seed.club,
    era: seed.era,
    source: 'catalog',
  };
}

export function expandSeedCoach(seed: SeedCoach): Coach {
  return {
    id: `c-${slugify(seed.n)}`,
    kind: 'coach',
    name: seed.n,
    nationality: seed.nat,
    primePeriod: seed.prime,
    overall: seed.ovr,
    style: seed.style,
    preferredTactic: seed.tactic,
    modifiers: seed.m,
    rarity: rarityFor(seed.ovr),
    baseAuctionValue: baseValueFor(seed.ovr, 'coach'),
    tags: seed.tags,
    era: seed.era,
    source: 'catalog',
  };
}
