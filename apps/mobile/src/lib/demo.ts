import { BOT_ARCHETYPES, type BotArchetype, type LeagueView } from '@asta/core';
import { localClient, useSession } from './store/session';

/** Random bot line-up: as many different personalities as possible before any repeats. */
export function getRandomBots(count: number): BotArchetype[] {
  const bots: BotArchetype[] = [];
  let deck: BotArchetype[] = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) deck = [...BOT_ARCHETYPES].sort(() => Math.random() - 0.5);
    bots.push(deck.pop()!);
  }
  return bots;
}

/**
 * Demo Auction: a local league with bots added in random mode, started
 * immediately. Runs entirely on the device, no server needed.
 */
export async function startDemoAuction(): Promise<LeagueView> {
  const client = localClient();
  const { displayName } = useSession.getState();
  const view = await client.createLeague({
    config: {
      name: 'Demo Legends Cup',
      maxParticipants: 6,
      startingCredits: 20,
      format: 'double_round_robin',
      bidTimerSeconds: 8,
      openingTimerSeconds: 12,
      liveMatchSeconds: 75,
      poolPreset: 'MIXED',
      commentaryTone: 'epico',
    },
    teamName: `${displayName ?? 'Tu'} FC`,
  });
  const needed = view.config.maxParticipants - view.members.length;
  const bots = getRandomBots(needed);
  await client.command(view.id, 'lobby:addBots', { archetypes: bots });
  await client.command(view.id, 'auction:start', {});
  useSession.getState().setActiveLeague(view.id);
  return view;
}
