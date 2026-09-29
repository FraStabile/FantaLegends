import type { CatalogItem, Coach, LeagueConfig, Player, Position, Slot } from '../domain/types';
import { DomainError } from '../domain/errors';
import { slotRequirement, SLOTS } from '../domain/config';
import type { Rng } from '../util/rng';
import { expandSeedCoach, expandSeedPlayer } from './expand';
import { GOALKEEPERS } from './seed/goalkeepers';
import { DEFENDERS } from './seed/defenders';
import { MIDFIELDERS } from './seed/midfielders';
import { FORWARDS } from './seed/forwards';
import { COACHES } from './seed/coaches';

export const CATALOG_PLAYERS: Player[] = [...GOALKEEPERS, ...DEFENDERS, ...MIDFIELDERS, ...FORWARDS].map(expandSeedPlayer);
export const CATALOG_COACHES: Coach[] = COACHES.map(expandSeedCoach);

const BASE_INDEX = new Map<string, CatalogItem>([...CATALOG_PLAYERS, ...CATALOG_COACHES].map((i) => [i.id, i]));

/**
 * Read-only lookup of every item a league can reference: the seed catalog plus
 * the league's own custom / AI generated items.
 */
export class Catalog {
  private readonly extra: Map<string, CatalogItem>;

  constructor(customItems: CatalogItem[] = []) {
    this.extra = new Map(customItems.map((i) => [i.id, i]));
  }

  get(id: string): CatalogItem {
    const item = this.extra.get(id) ?? BASE_INDEX.get(id);
    if (!item) throw new DomainError('NOT_FOUND', `Item ${id} not found`);
    return item;
  }

  find(id: string): CatalogItem | undefined {
    return this.extra.get(id) ?? BASE_INDEX.get(id);
  }

  player(id: string): Player {
    const item = this.get(id);
    if (item.kind !== 'player') throw new DomainError('INVALID_INPUT', `${id} is not a player`);
    return item;
  }

  coach(id: string): Coach {
    const item = this.get(id);
    if (item.kind !== 'coach') throw new DomainError('INVALID_INPUT', `${id} is not a coach`);
    return item;
  }

  static slotOf(item: CatalogItem): Slot {
    return item.kind === 'coach' ? 'COACH' : item.position;
  }
}

// ───────────────────────────── Thematic sets & presets ─────────────────────

export interface PoolSetDefinition {
  id: string;
  label: string;
  emoji: string;
  matches: (item: CatalogItem) => boolean;
}

const hasTag = (tag: string) => (i: CatalogItem) => i.tags.includes(tag);

export const POOL_SETS: PoolSetDefinition[] = [
  { id: 'legend', label: 'Legends', emoji: '👑', matches: hasTag('legend') },
  { id: 'modern', label: 'Modern Stars', emoji: '⚡', matches: hasTag('modern') },
  { id: 'world_cup', label: 'World Cup', emoji: '🌍', matches: hasTag('world_cup') },
  { id: 'serie_a', label: 'Serie A', emoji: '🇮🇹', matches: hasTag('serie_a') },
  { id: 'champions', label: 'Champions', emoji: '⭐', matches: hasTag('champions') },
  { id: 'premier', label: 'Premier League', emoji: '🦁', matches: hasTag('premier') },
  { id: 'laliga', label: 'LaLiga', emoji: '🐂', matches: hasTag('laliga') },
  { id: '2000s', label: 'Anni 2000', emoji: '💿', matches: (i) => i.era === '2000s' },
  { id: '90s', label: 'Anni 90', emoji: '📼', matches: (i) => i.era === '90s' },
  { id: '80s', label: 'Anni 80', emoji: '🕹️', matches: (i) => i.era === '80s' || i.era === '70s' },
  { id: 'cult', label: 'Cult Heroes', emoji: '🤪', matches: hasTag('cult') },
  { id: 'bidoni', label: 'Bidoni', emoji: '🗑️', matches: hasTag('bidoni') },
];

export const POOL_PRESETS: { id: LeagueConfig['poolPreset']; label: string; description: string }[] = [
  { id: 'LEGENDS', label: 'Legends', description: 'Solo leggende ritirate, nel loro prime' },
  { id: 'MODERN', label: 'Modern', description: 'Le stelle del calcio moderno' },
  { id: 'MIXED', label: 'Mixed', description: 'Leggende e stelle moderne insieme' },
  { id: 'RANDOM', label: 'Random', description: 'Un pool casuale e imprevedibile, ogni volta diverso' },
  { id: 'CUSTOM', label: 'Custom', description: 'Solo i giocatori aggiunti dal Master o generati con l\'AI' },
];

function presetFilter(cfg: LeagueConfig): (i: CatalogItem) => boolean {
  const sets = POOL_SETS.filter((s) => cfg.poolSets.includes(s.id));
  const setFilter = sets.length ? (i: CatalogItem) => sets.some((s) => s.matches(i)) : () => true;
  switch (cfg.poolPreset) {
    case 'LEGENDS':
      return (i) => i.tags.includes('legend') && setFilter(i);
    case 'MODERN':
      return (i) => i.tags.includes('modern') && setFilter(i);
    default:
      return setFilter;
  }
}

/** Every item eligible for the league, before sampling. */
export function eligibleItems(cfg: LeagueConfig, customItems: CatalogItem[]): CatalogItem[] {
  // CUSTOM: exactly what the Master added (manually, from the database or with the AI)
  if (cfg.poolPreset === 'CUSTOM') return customItems;
  const filter = presetFilter(cfg);
  const seen = new Set<string>();
  return [...customItems, ...CATALOG_PLAYERS, ...CATALOG_COACHES].filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), filter(i))));
}

/**
 * Build the auction pool: for every slot draw `need × (1 + extraRatio)` items,
 * where need = requirement × number of teams. Throws POOL_TOO_SMALL if a slot
 * cannot be covered at all.
 */
export function buildPool(cfg: LeagueConfig, customItems: CatalogItem[], teamCount: number, rng: Rng): string[] {
  const items = eligibleItems(cfg, customItems);
  const pool: string[] = [];
  const extraRatio = cfg.poolPreset === 'RANDOM' ? 0.3 + rng.next() * 1.2 : cfg.poolExtraRatio;
  for (const slot of SLOTS) {
    const need = slotRequirement(cfg, slot) * teamCount;
    if (need === 0) continue;
    const candidates = items.filter((i) => Catalog.slotOf(i) === slot);
    if (candidates.length < need) {
      throw new DomainError('POOL_TOO_SMALL', `Servono almeno ${need} elementi per il ruolo ${slot}, disponibili ${candidates.length}`);
    }
    const wanted = Math.min(candidates.length, Math.ceil(need * (1 + extraRatio)));
    pool.push(...rng.shuffle(candidates).slice(0, wanted).map((i) => i.id));
  }
  return pool;
}

export function countBySlot(ids: string[], catalog: Catalog): Record<Slot, number> {
  const out: Record<Slot, number> = { GK: 0, DF: 0, MF: 0, FW: 0, COACH: 0 };
  for (const id of ids) out[Catalog.slotOf(catalog.get(id))]++;
  return out;
}

export function playersByPosition(position: Position): Player[] {
  return CATALOG_PLAYERS.filter((p) => p.position === position);
}
