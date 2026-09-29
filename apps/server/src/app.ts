import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import type { Scheduler } from '@asta/core';
import { openDatabase } from './db/database.js';
import { LeagueRepository } from './db/leagueRepository.js';
import { UserRepository } from './db/userRepository.js';
import { LeagueRegistry } from './leagueRegistry.js';
import { NotificationService } from './notifications/notificationService.js';
import { PlayerGenerator } from './ai/playerGenerator.js';
import { registerRoutes } from './http/routes.js';
import { SocketGateway } from './realtime/socketGateway.js';
import type { ServerConfig } from './config.js';

/** Composition root: wires persistence, league runtime, HTTP, realtime and notifications. */
export async function createApp(cfg: ServerConfig, opts: { scheduler?: Scheduler; logger?: boolean } = {}) {
  const db = openDatabase(cfg.databasePath);
  const users = new UserRepository(db);
  const leagues = new LeagueRepository(db);
  const registry = new LeagueRegistry(leagues, opts.scheduler);
  const generator = new PlayerGenerator(cfg.anthropicModel, cfg.aiEnabled);

  const app = Fastify({ logger: opts.logger ?? false });
  const origin = cfg.corsOrigin === '*' ? true : cfg.corsOrigin.split(',');
  await app.register(cors, { origin, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  registerRoutes(app, { users, leagues, registry, generator, publicUrl: cfg.publicUrl });

  const io = new Server(app.server, {
    cors: { origin },
    // fast detection of dropped mobile connections
    pingInterval: 10_000,
    pingTimeout: 8_000,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
  });
  const gateway = new SocketGateway(io, registry, users);
  const notifications = new NotificationService(users, (userId, n) => gateway.notify(userId, n), cfg.expoPushEnabled);
  registry.onHost((host) => notifications.attach(host));

  // resume leagues with running timers (auction in progress, live matches) after a restart
  const active = db.prepare("SELECT id FROM leagues WHERE status IN ('auction', 'season')").all() as { id: string }[];
  registry.resumeActive(active.map((r) => r.id));

  return {
    app,
    io,
    registry,
    db,
    async close() {
      // sockets first (their disconnect handlers touch the leagues), then timers, then storage
      await new Promise<void>((resolve) => io.close(() => resolve()));
      registry.dispose();
      await app.close();
      db.close();
    },
  };
}
