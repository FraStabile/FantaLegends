import { LeagueHost, ManualScheduler, type LeagueConfigInput, type BotArchetype } from '../src/index';

export const MASTER = 'u-master';
export const USERS = ['u-master', 'u-marco', 'u-luca', 'u-giulia', 'u-sara', 'u-pietro'];

/** Creates a league in the lobby with `humans` human members (all ready). */
export function lobby(opts: { humans?: number; bots?: BotArchetype[]; config?: LeagueConfigInput; botsEnabled?: boolean; seed?: number } = {}) {
  const scheduler = new ManualScheduler();
  const host = LeagueHost.create(
    {
      id: 'lg1',
      code: 'X7K92P',
      config: { name: 'Champions degli Scappati', maxParticipants: 8, startingCredits: 100, ...opts.config },
      master: { userId: MASTER, displayName: 'Francesco', avatar: '🦁', teamName: 'Francesco FC' },
    },
    { scheduler, seed: opts.seed ?? 1234, botsEnabled: opts.botsEnabled ?? false },
  );
  const humans = opts.humans ?? 2;
  for (let i = 1; i < humans; i++) {
    const id = USERS[i];
    host.join({ userId: id, displayName: id.slice(2), avatar: '⚽' });
    host.setReady(id, true);
  }
  if (opts.bots?.length) host.addBots(MASTER, opts.bots);
  return { host, scheduler };
}

/** League with the auction started and the first lot open. */
export function auction(opts: Parameters<typeof lobby>[0] = {}) {
  const ctx = lobby(opts);
  ctx.host.startAuction(MASTER);
  return ctx;
}

export function lot(host: LeagueHost) {
  const l = host.state.auction.currentLot;
  if (!l) throw new Error('no open lot');
  return l;
}

let bidSeq = 0;
export function bid(host: LeagueHost, userId: string, amount: number, lotId = lot(host).id, bidId = `b${++bidSeq}`) {
  return host.placeBid(userId, { lotId, amount, bidId });
}

export function teamOf(host: LeagueHost, userId: string) {
  return host.state.teams.find((t) => t.ownerId === userId)!;
}

/** Let the current lot expire and the next one open. */
export function expireLot(host: LeagueHost, scheduler: ManualScheduler) {
  const l = lot(host);
  scheduler.advance(l.endsAt - scheduler.now());
}
