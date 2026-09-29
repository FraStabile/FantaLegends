import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createCustomPlayer, customPlayerSchema, DomainError, LOGO_COLORS, LOGO_EMOJIS, type CatalogItem } from '@asta/core';
import type { UserRepository, User } from '../db/userRepository.js';
import type { LeagueRepository } from '../db/leagueRepository.js';
import type { LeagueRegistry } from '../leagueRegistry.js';
import type { PlayerGenerator } from '../ai/playerGenerator.js';
import { toErrorBody } from '../errors.js';

export interface RouteDeps {
  users: UserRepository;
  leagues: LeagueRepository;
  registry: LeagueRegistry;
  generator: PlayerGenerator;
  publicUrl: string;
}

const displayName = z.string().trim().min(2).max(20);
const avatar = z.string().min(1).max(8);
const logo = z.object({ emoji: z.string().min(1).max(8), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });

/** AI generations waiting for the Master's confirmation (items never come back from the client). */
const pendingGenerations = new Map<string, { leagueId: string; userId: string; items: CatalogItem[]; expires: number }>();

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { users, leagues, registry, generator } = deps;

  app.setErrorHandler((err, _req, reply) => {
    const { status, body } = toErrorBody(err);
    reply.status(status).send(body);
  });

  const auth = (req: FastifyRequest): User => {
    const header = req.headers.authorization ?? '';
    const user = users.byToken(header.startsWith('Bearer ') ? header.slice(7) : null);
    if (!user) throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
    return user;
  };
  const unauthorized = (reply: FastifyReply) => reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Sessione non valida' });
  const guarded = <T>(handler: (req: FastifyRequest, user: User) => Promise<T> | T) => async (req: FastifyRequest, reply: FastifyReply) => {
    let user: User;
    try {
      user = auth(req);
    } catch {
      return unauthorized(reply);
    }
    return handler(req, user);
  };

  app.get('/health', async () => ({ ok: true, ai: generator.online ? 'claude' : 'offline', time: Date.now() }));

  // ── auth / profile
  app.post('/auth/guest', async (req) => {
    const body = z.object({ displayName, avatar: avatar.default('⚽') }).parse(req.body);
    const { user, token } = users.createGuest(body.displayName, body.avatar);
    return { user, token };
  });

  app.get('/me', guarded((_req, user) => ({ user })));

  app.patch('/me', guarded((req, user) => {
    const body = z.object({ displayName: displayName.optional(), avatar: avatar.optional(), pushToken: z.string().max(200).nullable().optional() }).parse(req.body);
    return { user: users.update(user.id, body) };
  }));

  // ── leagues
  app.get('/leagues', guarded((_req, user) => ({ leagues: leagues.summaries(user.id) })));

  app.post('/leagues', guarded((req, user) => {
    const body = z.object({ config: z.record(z.string(), z.unknown()), teamName: z.string().max(28).optional(), logo: logo.optional() }).parse(req.body);
    const host = registry.create({ userId: user.id, displayName: user.displayName, avatar: user.avatar, teamName: body.teamName, logo: body.logo }, body.config as never);
    return { league: host.view(user.id), inviteUrl: `${deps.publicUrl}/${host.state.code}` };
  }));

  app.get('/invite/:code', async (req) => {
    const { code } = z.object({ code: z.string().min(4).max(10) }).parse(req.params);
    const s = registry.byCode(code).state;
    return {
      id: s.id,
      name: s.config.name,
      code: s.code,
      status: s.status,
      members: s.members.map((m) => ({ displayName: m.displayName, avatar: m.avatar, isMaster: m.isMaster })),
      maxParticipants: s.config.maxParticipants,
    };
  });

  app.post('/leagues/join', guarded((req, user) => {
    const body = z.object({ code: z.string().min(4).max(10), teamName: z.string().max(28).optional(), logo: logo.optional() }).parse(req.body);
    const host = registry.byCode(body.code);
    if (!host.isMember(user.id)) {
      host.join({ userId: user.id, displayName: user.displayName, avatar: user.avatar, teamName: body.teamName, logo: body.logo ?? { emoji: LOGO_EMOJIS[host.state.teams.length % LOGO_EMOJIS.length], color: LOGO_COLORS[host.state.teams.length % LOGO_COLORS.length] } });
    }
    return { league: host.view(user.id) };
  }));

  const memberHost = (leagueId: string, userId: string) => {
    const host = registry.get(leagueId);
    if (!host.isMember(userId)) throw new DomainError('FORBIDDEN');
    return host;
  };

  app.get('/leagues/:id', guarded((req, user) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { league: memberHost(id, user.id).view(user.id) };
  }));

  app.get('/leagues/:id/matches/:matchId', guarded((req, user) => {
    const { id, matchId } = z.object({ id: z.string(), matchId: z.string() }).parse(req.params);
    return { match: memberHost(id, user.id).matchView(matchId) };
  }));

  app.get('/leagues/:id/stats', guarded((req, user) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { stats: memberHost(id, user.id).statistics() };
  }));

  // ── custom players & AI generator (Master only, lobby only: enforced by the host)
  app.post('/leagues/:id/custom-players', guarded((req, user) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const player = createCustomPlayer(customPlayerSchema.parse(req.body));
    const host = memberHost(id, user.id);
    host.addCustomItems(user.id, [player]);
    return { item: player, league: host.view(user.id) };
  }));

  app.delete('/leagues/:id/custom-players/:itemId', guarded((req, user) => {
    const { id, itemId } = z.object({ id: z.string(), itemId: z.string() }).parse(req.params);
    const host = memberHost(id, user.id);
    host.removeCustomItem(user.id, itemId);
    return { league: host.view(user.id) };
  }));

  app.post('/leagues/:id/ai/generate', guarded(async (req, user) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { prompt } = z.object({ prompt: z.string().trim().min(5).max(500) }).parse(req.body);
    const host = memberHost(id, user.id);
    if (!host.state.members.find((m) => m.userId === user.id)?.isMaster) throw new DomainError('FORBIDDEN');
    const exclude = new Set(host.state.customItems.map((i) => i.id));
    const outcome = await generator.generate(prompt, id, exclude);
    const generationId = randomUUID();
    pendingGenerations.set(generationId, { leagueId: id, userId: user.id, items: outcome.items, expires: Date.now() + 30 * 60_000 });
    for (const [k, v] of pendingGenerations) if (v.expires < Date.now()) pendingGenerations.delete(k);
    return { generationId, source: outcome.source, note: outcome.note ?? null, rejected: outcome.rejected, request: outcome.request, items: outcome.items };
  }));

  app.post('/leagues/:id/ai/confirm', guarded((req, user) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ generationId: z.string(), itemIds: z.array(z.string()).max(100).optional() }).parse(req.body);
    const pending = pendingGenerations.get(body.generationId);
    if (!pending || pending.leagueId !== id || pending.userId !== user.id) throw new DomainError('NOT_FOUND');
    const chosen = body.itemIds ? pending.items.filter((i) => body.itemIds!.includes(i.id)) : pending.items;
    const host = memberHost(id, user.id);
    host.addCustomItems(user.id, chosen, `${chosen.length} nuovi campioni aggiunti al database della lega`);
    pendingGenerations.delete(body.generationId);
    return { league: host.view(user.id), added: chosen.length };
  }));
}
