import type { BotArchetype, CatalogItem, Coach, League, Member, Player, Team } from '../domain/types';
import { Catalog } from '../catalog/catalog';
import { totalSlots } from '../domain/config';
import { maxBid } from '../economy/budget';
import { canAcquireSlot, remainingSlots, slotNeeds } from '../team/teamValidation';
import { minimumNextBid } from '../auction/bidValidation';
import { hashString, type Rng } from '../util/rng';

/** When a bot places its bid within the lot window. */
export type BotTiming = 'early' | 'normal' | 'late';

export interface BotProfile {
  archetype: BotArchetype;
  label: string;
  emoji: string;
  description: string;
  /** multiplier over the reference price */
  greed: number;
  /** reaction delay window (ms) */
  reaction: [number, number];
  /** 'late' bots wait for the last second (sniping) instead of reacting at once */
  timing: BotTiming;
  /** probability of jumping with a bigger increment */
  jumpChance: number;
  /** how much the bot's opinion of a price varies from item to item (±) */
  noise: number;
}

export const BOT_PROFILES: Record<BotArchetype, BotProfile> = {
  saver: {
    archetype: 'saver',
    label: 'Il Risparmiatore',
    emoji: '🐷',
    description: 'Spende poco, aspetta l\'affare e colpisce all\'ultimo',
    greed: 0.72,
    reaction: [2200, 5200],
    timing: 'late',
    jumpChance: 0.02,
    noise: 0.12,
  },
  shark: {
    archetype: 'shark',
    label: 'Lo Squalo',
    emoji: '🦈',
    description: 'Rilancia forte e subito sui big, e se lo sfidi si arrabbia',
    greed: 1.15,
    reaction: [500, 1800],
    timing: 'early',
    jumpChance: 0.35,
    noise: 0.15,
  },
  fan: {
    archetype: 'fan',
    label: 'Il Fan',
    emoji: '🤩',
    description: 'Strapaga i suoi idoli, ignora il resto',
    greed: 0.9,
    reaction: [800, 3200],
    timing: 'normal',
    jumpChance: 0.15,
    noise: 0.2,
  },
  tactician: {
    archetype: 'tactician',
    label: 'Il Tattico',
    emoji: '🧠',
    description: 'Distribuisce il budget sui ruoli e cerca l\'allenatore giusto',
    greed: 1.0,
    reaction: [1200, 3600],
    timing: 'normal',
    jumpChance: 0.08,
    noise: 0.1,
  },
  sniper: {
    archetype: 'sniper',
    label: 'Il Cecchino',
    emoji: '🎯',
    description: 'Non si fa mai vedere: spara l\'offerta nell\'ultimo secondo',
    greed: 1.05,
    reaction: [400, 1200],
    timing: 'late',
    jumpChance: 0,
    noise: 0.1,
  },
  gambler: {
    archetype: 'gambler',
    label: 'Lo Scommettitore',
    emoji: '🎲',
    description: 'Imprevedibile: rilanci pazzi, colpi di testa e qualche bidone "per scommessa"',
    greed: 1.0,
    reaction: [300, 4500],
    timing: 'normal',
    jumpChance: 0.4,
    noise: 0.45,
  },
  moneyball: {
    archetype: 'moneyball',
    label: 'Il Moneyball',
    emoji: '📊',
    description: 'Guarda solo i numeri: evita le star sopravvalutate e compra solidità a buon prezzo',
    greed: 1.0,
    reaction: [1500, 3500],
    timing: 'normal',
    jumpChance: 0.03,
    noise: 0.05,
  },
  provocateur: {
    archetype: 'provocateur',
    label: 'Il Provocatore',
    emoji: '😈',
    description: 'Gonfia i prezzi dei big per svuotare le tasche agli altri, poi si sfila',
    greed: 0.85,
    reaction: [600, 2000],
    timing: 'early',
    jumpChance: 0.25,
    noise: 0.15,
  },
  kamikaze: {
    archetype: 'kamikaze',
    label: 'Il Kamikaze',
    emoji: '💣',
    description: 'Tutto il budget su un paio di fuoriclasse, il resto a un credito',
    greed: 1.0,
    reaction: [700, 2500],
    timing: 'normal',
    jumpChance: 0.2,
    noise: 0.1,
  },
};

export const BOT_NAMES: Record<BotArchetype, string[]> = {
  saver: ['Zio Paperone', 'Il Braccino', 'Mister Sconto', 'Il Ragioniere'],
  shark: ['Lo Squalo', 'Il Magnate', 'Re Mida', 'Il Presidentissimo'],
  fan: ['Il Tifoso', 'Cuore Nerazzurro', 'Nostalgia 90', 'Il Collezionista'],
  tactician: ['Il Professore', 'Mister Lavagna', 'Il Tattico', 'Zona Mista'],
  sniper: ['Il Cecchino', 'Zero Secondi', 'Occhio di Falco', 'Last Minute'],
  gambler: ['Il Giocatore', 'Tutto su Rosso', 'Er Bomba', 'Il Fantasista'],
  moneyball: ['Il Moneyball', 'Mister Excel', 'Algoritmo FC', 'Il Direttore Sportivo'],
  provocateur: ['Il Provocatore', 'Il Disturbatore', 'Faccia da Poker', 'Il Rilanciatore'],
  kamikaze: ['Il Kamikaze', 'All-In', 'Il Sognatore', 'Galácticos'],
};

/** Fan favourites: a fan bot adores a deterministic subset of tags/nationalities. */
const FAN_LOVES = [
  { tags: ['serie_a', 'italia'], nat: ['ITA'] },
  { tags: ['legend'], nat: ['BRA'] },
  { tags: ['world_cup'], nat: ['ARG'] },
  { tags: ['premier'], nat: ['ENG'] },
  { tags: ['laliga'], nat: ['ESP'] },
];

function fanLoves(member: Member, item: CatalogItem): boolean {
  const love = FAN_LOVES[hashString(member.userId) % FAN_LOVES.length];
  return item.tags.some((t) => love.tags.includes(t)) || love.nat.includes(item.nationality) || item.rarity === 'legendary';
}

/** Deterministic per (bot,item) noise in [−spread, +spread]: bots disagree on prices. */
function personalNoise(member: Member, itemId: string, spread: number): number {
  const h = hashString(`${member.userId}|${itemId}`) / 0xffffffff;
  return (h * 2 - 1) * spread;
}

/** Deterministic per (bot,item) coin flip, stable across re-thinks of the same lot. */
function personalChance(member: Member, itemId: string, p: number): boolean {
  return hashString(`${itemId}|${member.userId}|flip`) / 0xffffffff < p;
}

const isBidone = (item: CatalogItem) => item.tags.includes('bidoni');

/**
 * Reference price of an item in this league's economy. Seed base values are
 * calibrated for 100 credits and 6 slots; they scale with the real budget per slot,
 * and with scarcity (few items left for a role that many teams still need).
 */
export function referencePrice(item: CatalogItem, league: League, catalog: Catalog): number {
  const cfg = league.config;
  const scale = (cfg.startingCredits / 100) * (6 / Math.max(1, totalSlots(cfg)));
  const slot = Catalog.slotOf(item);
  const demand = league.teams.reduce((s, t) => s + slotNeeds(t, cfg)[slot], 0);
  const supply =
    league.auction.queue.filter((id) => Catalog.slotOf(catalog.get(id)) === slot).length + league.auction.unsold.length / 2 + 1;
  const scarcity = Math.min(1.6, Math.max(0.85, demand / supply + 0.6));
  return Math.max(cfg.minPrice, item.baseAuctionValue * scale * scarcity);
}

/**
 * Where the item ranks among what is still to come for its role: 1 = nothing better
 * left in the queue ("last train"), 0 = plenty of better alternatives ahead.
 */
function scarcityOfQuality(item: CatalogItem, league: League, catalog: Catalog): number {
  const slot = Catalog.slotOf(item);
  const ahead = league.auction.queue.map((id) => catalog.get(id)).filter((i) => Catalog.slotOf(i) === slot);
  if (ahead.length === 0) return 1;
  const better = ahead.filter((i) => i.overall > item.overall).length;
  return 1 - better / ahead.length;
}

/** How well a coach's preferred tactic fits the squad the team owns so far (0.8–1.3). */
function coachFit(coach: Coach, team: Team, catalog: Catalog): number {
  const players = team.roster.filter((r) => r.kind === 'player').map((r) => catalog.player(r.itemId));
  if (players.length === 0) return 1;
  const avg = (f: (p: Player) => number) => players.reduce((s, p) => s + f(p), 0) / players.length;
  const pass = avg((p) => p.stats.passing);
  const pace = avg((p) => p.stats.pace);
  const def = avg((p) => p.stats.defending);
  const phy = avg((p) => p.stats.physical);
  const fit: Record<Coach['preferredTactic'], number> = {
    possession: pass,
    total_football: (pass + pace) / 2,
    gegenpress: (pace + phy) / 2,
    counter: pace,
    catenaccio: def + 15,
    direct: phy,
    balanced: 75,
  };
  return 0.8 + Math.min(0.5, Math.max(0, (fit[coach.preferredTactic] - 60) / 60));
}

/** Bids this bot already placed on the current lot (it was outbid after each), for the shark's tilt. */
function bidsOnCurrentLot(member: Member, league: League): number {
  return league.auction.currentLot?.bids.filter((b) => b.teamId === member.teamId).length ?? 0;
}

/** Maximum price this bot is willing to pay for the current item. */
export function botValuation(member: Member, team: Team, item: CatalogItem, league: League, catalog: Catalog): number {
  const profile = BOT_PROFILES[member.bot ?? 'tactician'];
  const cfg = league.config;
  const ref = referencePrice(item, league, catalog);
  let value = ref * profile.greed * (1 + personalNoise(member, item.id, profile.noise));

  const left = remainingSlots(team, cfg);
  const perSlot = team.credits / Math.max(1, left);
  const quality = scarcityOfQuality(item, league, catalog);

  // nobody sane pays real money for a flop (the gambler has its own ideas, see below)
  if (isBidone(item) && profile.archetype !== 'gambler') value = Math.min(value, cfg.minPrice + (profile.archetype === 'fan' && item.tags.includes('cult') ? cfg.minIncrement : 0));

  switch (profile.archetype) {
    case 'saver':
      value = Math.min(value, perSlot * 1.4);
      break;
    case 'shark': {
      // hunts the big names; the supporting cast is not worth a war
      if (item.overall >= 88) value *= 1.3;
      else value = Math.min(value * 0.8, perSlot * 1.6);
      // tilt: every time someone outbids the shark on the same lot it wants it more
      value *= 1 + Math.min(0.25, bidsOnCurrentLot(member, league) * 0.06);
      break;
    }
    case 'fan':
      value *= fanLoves(member, item) ? 1.85 : 0.75;
      break;
    case 'tactician': {
      const weights: Record<string, number> = { GK: 0.9, DF: 0.95, MF: 1.05, FW: 1.1, COACH: 1.0 };
      value = Math.min(value * weights[Catalog.slotOf(item)] * (0.9 + quality * 0.25), perSlot * 2.2);
      if (item.kind === 'coach') value *= coachFit(item, team, catalog);
      break;
    }
    case 'sniper':
      value = Math.min(value * (0.95 + quality * 0.15), perSlot * 2.5);
      break;
    case 'gambler':
      // a hunch on a flop, or on anyone, from time to time
      if (isBidone(item)) value = personalChance(member, item.id, 0.25) ? Math.max(value, cfg.minPrice + perSlot * 0.4) : cfg.minPrice;
      else if (personalChance(member, item.id, 0.15)) value *= 1.6;
      break;
    case 'moneyball': {
      // value from the rating curve without the "hype" premium on the superstars
      const hype = item.overall >= 92 ? 0.7 : item.overall >= 88 ? 0.85 : item.overall >= 78 ? 1.2 : 1;
      value = Math.min(value * hype * (0.9 + quality * 0.2), perSlot * 1.8);
      break;
    }
    case 'provocateur': {
      // pushes the stars up to where it would still accept to be left holding them
      if (item.overall >= 88) value = Math.min(ref * 0.9, perSlot * 3);
      else value = Math.min(value, perSlot * 1.3);
      break;
    }
    case 'kamikaze': {
      const stars = team.roster.filter((r) => (catalog.find(r.itemId)?.overall ?? 0) >= 91).length;
      const targets = Math.min(2, Math.max(1, left - 1));
      if (item.overall >= 91 && stars < targets) value = Math.max(value * 1.6, (team.credits - (left - targets) * cfg.minPrice) / targets);
      else value = Math.min(value * 0.35, cfg.minPrice + cfg.minIncrement);
      break;
    }
  }

  // endgame: a bot that still needs this role and sees few alternatives must secure something
  const slot = Catalog.slotOf(item);
  const alternatives = league.auction.queue.filter((id) => Catalog.slotOf(catalog.get(id)) === slot).length;
  if (alternatives < slotNeeds(team, cfg)[slot] * 2) value = Math.max(value, perSlot * 0.8);

  return Math.floor(Math.min(value, maxBid(team, cfg)));
}

export interface BotDecision {
  amount: number;
}

/** Decide whether the bot bids on the current lot, and how much. Pure given the rng. */
export function decideBotBid(member: Member, league: League, catalog: Catalog, rng: Rng): BotDecision | null {
  const lot = league.auction.currentLot;
  if (league.auction.status !== 'lot_open' || !lot || !member.bot) return null;
  const team = league.teams.find((t) => t.id === member.teamId);
  if (!team || lot.leaderTeamId === team.id) return null;
  if (!canAcquireSlot(team, league.config, lot.slot)) return null;

  const item = catalog.get(lot.itemId);
  const cap = botValuation(member, team, item, league, catalog);
  const min = minimumNextBid(lot, league);
  if (min > cap) return null;

  const profile = BOT_PROFILES[member.bot];
  const inc = league.config.minIncrement;
  let amount = min;
  if (rng.chance(profile.jumpChance)) {
    // jumps scale with the price level of the item, not with a fixed number of credits
    const jump = Math.max(inc, Math.round((cap - min) * (0.15 + rng.next() * (profile.archetype === 'gambler' ? 0.6 : 0.3))));
    amount = Math.min(cap, min + jump);
  } else if (lot.bids.length === 0 && (profile.archetype === 'shark' || (profile.archetype === 'provocateur' && item.overall >= 88))) {
    // open strong to scare the room
    amount = Math.min(cap, Math.max(min, Math.round(cap * (profile.archetype === 'shark' ? 0.45 : 0.55))));
  }
  return { amount };
}

/**
 * Delay before the bot reacts to a change on the lot, or null if it cannot make it.
 * `remainingMs` is the time left on the lot: 'late' bots aim for its last second,
 * the others react within their window and, if that would be too late, rush a
 * last-moment bid instead of silently giving up.
 */
export function botReactionDelay(member: Member, rng: Rng, remainingMs = Infinity): number | null {
  const profile = BOT_PROFILES[member.bot ?? 'tactician'];
  const [lo, hi] = profile.reaction;
  const margin = 350;
  if (remainingMs <= margin) return null;
  if (profile.timing === 'late' && Number.isFinite(remainingMs)) {
    const target = remainingMs - rng.int(450, 1300);
    return Math.max(margin / 2, Math.min(target, remainingMs - margin));
  }
  const delay = rng.int(lo, hi);
  if (delay < remainingMs - margin) return delay;
  return remainingMs - rng.int(margin, Math.max(margin, Math.min(900, remainingMs - margin / 2)));
}
