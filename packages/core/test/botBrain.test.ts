import { describe, expect, it } from 'vitest';
import { BOT_ARCHETYPES, CATALOG_PLAYERS, Catalog, botReactionDelay, botValuation, createRng, type Member } from '../src/index';
import { MASTER, lobby } from './helpers';

const bot = (archetype: Member['bot']): Member =>
  ({ userId: `bot-${archetype}`, displayName: 'x', avatar: '🤖', teamId: 't', isMaster: false, ready: true, connected: true, bot: archetype, joinedAt: 0 }) as Member;

describe('Bot brain', () => {
  it('snipers wait for the last second, the others react early', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const late = botReactionDelay(bot('sniper'), rng, 8000)!;
      expect(late).toBeGreaterThan(6500);
      expect(late).toBeLessThan(8000);
      expect(botReactionDelay(bot('shark'), rng, 8000)!).toBeLessThan(2000);
    }
  });

  it('a slow bot rushes a last-moment bid instead of giving up on a short timer', () => {
    const rng = createRng(4);
    for (let i = 0; i < 50; i++) {
      const d = botReactionDelay(bot('tactician'), rng, 1500);
      expect(d).not.toBeNull();
      expect(d!).toBeLessThan(1500);
    }
    expect(botReactionDelay(bot('tactician'), rng, 200)).toBeNull();
  });

  it('only the gambler is ever tempted to pay real money for a bidone', () => {
    const { host } = lobby({ humans: 1, bots: [...BOT_ARCHETYPES], config: { maxParticipants: 10, startingCredits: 100 } });
    host.startAuction(MASTER);
    const league = host.state;
    const catalog = new Catalog();
    const flops = CATALOG_PLAYERS.filter((p) => p.tags.includes('bidoni'));
    expect(flops.length).toBeGreaterThan(20);
    for (const m of league.members.filter((x) => x.bot && x.bot !== 'gambler')) {
      const team = league.teams.find((t) => t.id === m.teamId)!;
      for (const p of flops) expect(botValuation(m, team, p, league, catalog)).toBeLessThanOrEqual(league.config.minPrice + league.config.minIncrement);
    }
  });

  it('every personality wins lots in a full bot auction', () => {
    const { host, scheduler } = lobby({ humans: 1, bots: [...BOT_ARCHETYPES], botsEnabled: true, config: { maxParticipants: 10, startingCredits: 100 } });
    host.startAuction(MASTER);
    scheduler.runAll();
    expect(host.state.auction.status).toBe('completed');
    for (const m of host.state.members.filter((x) => x.bot)) {
      const team = host.state.teams.find((t) => t.id === m.teamId)!;
      expect(team.roster.some((r) => !r.autoAssigned), m.bot!).toBe(true);
    }
  });
});
