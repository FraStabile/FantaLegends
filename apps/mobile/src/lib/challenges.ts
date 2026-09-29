import type { BotArchetype, LeagueConfigInput, LeagueView } from '@asta/core';
import { localClient, useSession } from './store/session';
import { getRandomBots } from './demo';

/**
 * Challenges: ready-made leagues against the bots, one tap from the home screen.
 * Each one has a theme (pool), a set of opponents and a goal: win the title.
 */
export interface Challenge {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  difficulty: 'Facile' | 'Media' | 'Difficile' | 'Pazza';
  /** opponents; null = random personalities */
  bots: BotArchetype[] | null;
  /** extra opponents drawn at random when `bots` is null */
  randomBots?: number;
  config: LeagueConfigInput;
}

/** Fast timers so a challenge flows: short lots and short live matches. */
const QUICK: LeagueConfigInput = { startingCredits: 20, bidTimerSeconds: 8, openingTimerSeconds: 12, liveMatchSeconds: 75 };

export const CHALLENGES: Challenge[] = [
  {
    id: 'serie-a',
    emoji: '🇮🇹',
    title: 'Sfida Serie A',
    tagline: 'Solo giocatori e allenatori passati dalla Serie A. Tre avversari alla portata: perfetta per iniziare.',
    difficulty: 'Facile',
    bots: ['tactician', 'saver', 'fan'],
    config: { ...QUICK, name: 'Sfida Serie A', maxParticipants: 4, format: 'round_robin', playoffs: true, playoffTeams: 2, poolPreset: 'MIXED', poolSets: ['serie_a'], commentaryTone: 'bar_sport' },
  },
  {
    id: 'mondiale',
    emoji: '🌍',
    title: 'Notti Mondiali',
    tagline: 'Campioni del mondo, eliminazione diretta: semifinale e finale, niente seconde possibilità.',
    difficulty: 'Media',
    bots: ['shark', 'tactician', 'sniper'],
    config: { ...QUICK, name: 'Notti Mondiali', maxParticipants: 4, format: 'knockout', poolPreset: 'MIXED', poolSets: ['world_cup'], commentaryTone: 'classico' },
  },
  {
    id: 'bidoni',
    emoji: '🗑️',
    title: 'Coppa dei Bidoni',
    tagline: 'Solo pippe leggendarie. Vince chi sbaglia meno: chi prende Ali Dia?',
    difficulty: 'Pazza',
    bots: ['gambler', 'fan', 'provocateur'],
    config: { ...QUICK, name: 'Coppa dei Bidoni', maxParticipants: 4, format: 'knockout', poolPreset: 'MIXED', poolSets: ['bidoni'], commentaryTone: 'trash' },
  },
  {
    id: 'leggende',
    emoji: '👑',
    title: 'Notte delle Leggende',
    tagline: 'Solo leggende nel loro prime, contro i bot più furbi: Squalo, Cecchino, Kamikaze e Moneyball.',
    difficulty: 'Difficile',
    bots: ['shark', 'sniper', 'kamikaze', 'moneyball', 'tactician'],
    config: { ...QUICK, name: 'Notte delle Leggende', maxParticipants: 6, format: 'round_robin', playoffs: true, playoffTeams: 4, poolPreset: 'LEGENDS', commentaryTone: 'epico' },
  },
  {
    id: 'quick',
    emoji: '⚡',
    title: 'Avvio veloce',
    tagline: 'Leggende e stelle moderne contro 5 bot a caso, andata e ritorno.',
    difficulty: 'Media',
    bots: null,
    randomBots: 5,
    config: { ...QUICK, name: 'Legends Cup', maxParticipants: 6, format: 'double_round_robin', poolPreset: 'MIXED', commentaryTone: 'epico' },
  },
];

export const DIFFICULTY_COLOR: Record<Challenge['difficulty'], string> = { Facile: '#22C55E', Media: '#06B6D4', Difficile: '#EF4444', Pazza: '#A855F7' };

/** Creates the challenge league on the device, adds the bots and opens the auction. */
export async function startChallenge(challenge: Challenge): Promise<LeagueView> {
  const client = localClient();
  const { displayName } = useSession.getState();
  const view = await client.createLeague({ config: challenge.config, teamName: `${displayName ?? 'Tu'} FC` });
  const bots = challenge.bots ?? getRandomBots(challenge.randomBots ?? view.config.maxParticipants - 1);
  await client.command(view.id, 'lobby:addBots', { archetypes: bots });
  await client.command(view.id, 'auction:start', {});
  const s = useSession.getState();
  s.setActiveLeague(view.id);
  s.recordChallenge(view.id, challenge.id);
  return view;
}
