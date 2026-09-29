import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { BOT_ARCHETYPES, DomainError, TALK_PHRASES, TALK_TONES, type DomainEvent, type LeagueHost, type TalkPhrase, type TalkTone } from '@asta/core';
import type { LeagueRegistry } from '../leagueRegistry.js';
import type { User, UserRepository } from '../db/userRepository.js';
import type { AppNotification } from '../notifications/notificationService.js';
import { toErrorBody } from '../errors.js';

type Ack = (res: { ok: true; data?: unknown } | { ok: false; error: string; message: string }) => void;

interface SocketData {
  user: User;
  leagues: Set<string>;
  bidTimes: number[];
}

const room = (leagueId: string) => `league:${leagueId}`;
const userRoom = (userId: string) => `user:${userId}`;

/** Domain events forwarded to clients for animations/haptics (state itself travels as snapshots). */
const LIVE_EVENTS = new Set<DomainEvent['type']>(['LotOpened', 'BidPlaced', 'Outbid', 'PlayerSold', 'LotUnsold', 'AuctionCompleted', 'AuctionPaused', 'AuctionResumed', 'MatchStarted', 'MatchEnded', 'TournamentCompleted', 'TeamCompleted']);

const schemas = {
  subscribe: z.object({ leagueId: z.string().min(1) }),
  leagueOnly: z.object({ leagueId: z.string().min(1) }),
  ready: z.object({ leagueId: z.string(), ready: z.boolean() }),
  config: z.object({ leagueId: z.string(), config: z.record(z.string(), z.unknown()) }),
  team: z.object({ leagueId: z.string(), name: z.string().max(28).optional(), logo: z.object({ emoji: z.string().max(8), color: z.string() }).optional() }),
  bots: z.object({ leagueId: z.string(), archetypes: z.array(z.enum(BOT_ARCHETYPES)).min(1).max(11) }),
  kick: z.object({ leagueId: z.string(), userId: z.string() }),
  bid: z.object({ leagueId: z.string(), lotId: z.string().min(1), amount: z.number(), bidId: z.string().min(6).max(80) }),
  play: z.object({ leagueId: z.string(), mode: z.enum(['live', 'instant']).default('live') }),
  react: z.object({ leagueId: z.string(), feedId: z.string(), emoji: z.string().max(8) }),
  comment: z.object({ leagueId: z.string(), feedId: z.string(), text: z.string().min(1).max(280) }),
  chat: z.object({ leagueId: z.string(), text: z.string().min(1).max(200) }),
  match: z.object({ leagueId: z.string(), matchId: z.string() }),
  talk: z.object({
    leagueId: z.string(),
    matchId: z.string(),
    phrase: z.enum(TALK_PHRASES.map((p) => p.id) as [TalkPhrase, ...TalkPhrase[]]),
    tone: z.enum(TALK_TONES.map((t) => t.id) as [TalkTone, ...TalkTone[]]),
  }),
};

/**
 * Realtime gateway. The client never decides anything: every message is a
 * *request* validated by the authoritative host; the answer comes back as an
 * ack, and the new state is pushed to everybody as a per-user projection.
 */
export class SocketGateway {
  private readonly pendingBroadcast = new Map<string, DomainEvent[]>();

  constructor(
    private readonly io: Server,
    private readonly registry: LeagueRegistry,
    private readonly users: UserRepository,
  ) {
    io.use((socket, next) => {
      const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
      const user = users.byToken(token);
      if (!user) return next(new Error('UNAUTHORIZED'));
      const data: SocketData = { user, leagues: new Set(), bidTimes: [] };
      socket.data = data;
      next();
    });
    io.on('connection', (socket) => this.onConnection(socket));
    registry.onChange((host, events) => this.scheduleBroadcast(host, events));
  }

  notify(userId: string, n: AppNotification): void {
    this.io.to(userRoom(userId)).emit('notification', n);
  }

  private onConnection(socket: Socket): void {
    const data = socket.data as SocketData;
    const userId = data.user.id;
    socket.join(userRoom(userId));

    const handle = <S extends z.ZodTypeAny>(event: string, schema: S, fn: (input: z.infer<S>, host: LeagueHost | null) => unknown, needsLeague = true) => {
      socket.on(event, (payload: unknown, ack?: Ack) => {
        const reply: Ack = typeof ack === 'function' ? ack : () => {};
        try {
          const input = schema.parse(payload ?? {});
          const leagueId = (input as { leagueId?: string }).leagueId;
          let host: LeagueHost | null = null;
          if (needsLeague && leagueId) {
            host = this.registry.get(leagueId);
            if (!host.isMember(userId)) throw new DomainError('FORBIDDEN');
          }
          const out = fn(input, host);
          reply({ ok: true, data: out });
        } catch (err) {
          const { body } = toErrorBody(err);
          reply({ ok: false, error: body.error, message: body.message });
        }
      });
    };

    handle('time:sync', z.object({}).passthrough(), () => ({ serverNow: Date.now() }), false);

    // subscribe = (re)join after connect/reconnect: returns the full snapshot, which carries the
    // current lot, its server-side deadline and everything that happened while offline
    handle('league:subscribe', schemas.subscribe, ({ leagueId }, host) => {
      socket.join(room(leagueId));
      data.leagues.add(leagueId);
      host!.setConnected(userId, true);
      return host!.view(userId);
    });

    handle('league:unsubscribe', schemas.leagueOnly, ({ leagueId }, host) => {
      socket.leave(room(leagueId));
      data.leagues.delete(leagueId);
      this.updatePresence(host!, userId);
    });

    handle('lobby:ready', schemas.ready, ({ ready }, host) => host!.setReady(userId, ready));
    handle('lobby:config', schemas.config, ({ config }, host) => host!.updateConfig(userId, config as never));
    handle('lobby:team', schemas.team, ({ name, logo }, host) => host!.updateTeam(userId, { name, logo }));
    handle('lobby:addBots', schemas.bots, ({ archetypes }, host) => host!.addBots(userId, archetypes));
    handle('lobby:kick', schemas.kick, ({ userId: target }, host) => host!.leave(target, userId));
    handle('lobby:leave', schemas.leagueOnly, (_i, host) => host!.leave(userId));

    handle('auction:start', schemas.leagueOnly, (_i, host) => host!.startAuction(userId));
    handle('auction:bid', schemas.bid, ({ lotId, amount, bidId }, host) => {
      const now = Date.now();
      data.bidTimes = data.bidTimes.filter((t) => now - t < 1000);
      if (data.bidTimes.length >= 8) throw new DomainError('RATE_LIMITED');
      data.bidTimes.push(now);
      return host!.placeBid(userId, { lotId, amount, bidId });
    });
    handle('auction:pause', schemas.leagueOnly, (_i, host) => host!.pauseAuction(userId));
    handle('auction:resume', schemas.leagueOnly, (_i, host) => host!.resumeAuction(userId));

    handle('season:start', schemas.leagueOnly, (_i, host) => host!.startSeason(userId));
    handle('round:play', schemas.play, ({ mode }, host) => host!.playRound(userId, mode).map((m) => m.id));
    handle('season:new', schemas.leagueOnly, (_i, host) => host!.newSeason(userId));
    handle('match:get', schemas.match, ({ matchId }, host) => host!.matchView(matchId));
    handle('match:talk', schemas.talk, ({ matchId, phrase, tone }, host) => host!.giveTeamTalk(userId, matchId, phrase, tone));
    handle('stats:get', schemas.leagueOnly, (_i, host) => host!.statistics());

    handle('feed:react', schemas.react, ({ feedId, emoji }, host) => host!.react(userId, feedId, emoji));
    handle('feed:comment', schemas.comment, ({ feedId, text }, host) => host!.comment(userId, feedId, text));
    handle('feed:chat', schemas.chat, ({ text }, host) => host!.chat(userId, text));

    socket.on('disconnect', () => {
      for (const leagueId of data.leagues) {
        try {
          this.updatePresence(this.registry.get(leagueId), userId);
        } catch {
          /* league deleted */
        }
      }
    });
  }

  /** A user is "connected" to a league while at least one of his sockets is subscribed to it. */
  private updatePresence(host: LeagueHost, userId: string): void {
    const sockets = this.io.sockets.adapter.rooms.get(room(host.id)) ?? new Set<string>();
    const stillThere = [...sockets].some((sid) => (this.io.sockets.sockets.get(sid)?.data as SocketData | undefined)?.user.id === userId);
    host.setConnected(userId, stillThere);
  }

  /**
   * Coalesces bursts (e.g. several bot bids in the same tick) into one snapshot
   * per socket, sent at the end of the current macrotask.
   */
  private scheduleBroadcast(host: LeagueHost, events: DomainEvent[]): void {
    const pending = this.pendingBroadcast.get(host.id);
    if (pending) {
      pending.push(...events);
      return;
    }
    this.pendingBroadcast.set(host.id, [...events]);
    setImmediate(() => {
      const evs = this.pendingBroadcast.get(host.id) ?? [];
      this.pendingBroadcast.delete(host.id);
      this.broadcast(host, evs);
    });
  }

  private broadcast(host: LeagueHost, events: DomainEvent[]): void {
    const sockets = this.io.sockets.adapter.rooms.get(room(host.id));
    if (!sockets) return;
    const blind = !host.state.config.visibility.bidderNames;
    const live = events
      .filter((e) => LIVE_EVENTS.has(e.type))
      .map((e) => (blind && (e.type === 'BidPlaced' || e.type === 'Outbid') ? { ...e, teamId: undefined, byTeamId: undefined } : e));
    const views = new Map<string, unknown>();
    for (const sid of sockets) {
      const s = this.io.sockets.sockets.get(sid);
      const uid = (s?.data as SocketData | undefined)?.user.id;
      if (!s || !uid) continue;
      if (!views.has(uid)) views.set(uid, host.view(uid));
      s.emit('league:state', views.get(uid));
      if (live.length) {
        // an Outbid event is personal: keep its target only for the concerned team owner
        s.emit('league:events', live);
      }
    }
  }
}
