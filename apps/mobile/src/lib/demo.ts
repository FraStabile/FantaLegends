import { BOT_ARCHETYPES, type BotArchetype } from '@asta/core';

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
