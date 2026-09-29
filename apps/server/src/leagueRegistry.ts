import { randomUUID } from 'node:crypto';
import {
  createRealScheduler,
  createRng,
  DomainError,
  generateInviteCode,
  LeagueHost,
  randomSeed,
  type DomainEvent,
  type League,
  type LeagueConfigInput,
  type Participant,
  type Scheduler,
} from '@asta/core';
import type { LeagueRepository } from './db/leagueRepository.js';

export type ChangeListener = (host: LeagueHost, events: DomainEvent[]) => void;

/**
 * Keeps one authoritative LeagueHost per active league in memory.
 *
 * Every accepted command is persisted synchronously (write-through) inside the
 * host's change hook, before it is broadcast: what clients see is always what
 * is in the database. Hosts are lazily rebuilt from SQLite, which also makes
 * a server restart transparent (timers are re-armed from the stored state).
 */
export class LeagueRegistry {
  private readonly hosts = new Map<string, LeagueHost>();
  private readonly listeners = new Set<ChangeListener>();
  private readonly hostListeners = new Set<(host: LeagueHost) => void>();
  private readonly scheduler: Scheduler;
  private disposed = false;

  constructor(
    private readonly repo: LeagueRepository,
    scheduler?: Scheduler,
  ) {
    this.scheduler = scheduler ?? createRealScheduler();
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called for every host created or loaded (e.g. to attach the notification service to its bus). */
  onHost(listener: (host: LeagueHost) => void): void {
    this.hostListeners.add(listener);
  }

  create(master: Participant, config: LeagueConfigInput): LeagueHost {
    const rng = createRng(randomSeed());
    let code = generateInviteCode(rng);
    for (let i = 0; this.repo.codeExists(code); i++) {
      if (i > 20) throw new DomainError('INVALID_STATE', 'Cannot allocate an invite code');
      code = generateInviteCode(rng);
    }
    const id = `lg-${randomUUID().slice(0, 12)}`;
    const host = LeagueHost.create({ id, code, config, master }, { scheduler: this.scheduler, seed: randomSeed(), hooks: this.hooks() });
    this.register(host);
    return host;
  }

  get(id: string): LeagueHost {
    if (this.disposed) throw new DomainError('INVALID_STATE', 'Server shutting down');
    const cached = this.hosts.get(id);
    if (cached) return cached;
    const loaded = this.repo.load(id);
    if (!loaded) throw new DomainError('NOT_FOUND');
    const host = new LeagueHost(loaded.league, loaded.results, { scheduler: this.scheduler, seed: randomSeed(), hooks: this.hooks() });
    this.register(host);
    return host;
  }

  byCode(code: string): LeagueHost {
    const id = this.repo.idByCode(code.trim().toUpperCase());
    if (!id) throw new DomainError('NOT_FOUND');
    return this.get(id);
  }

  /** Rebuild every league with running timers after a restart (auctions, live matches). */
  resumeActive(ids: string[]): void {
    for (const id of ids) this.get(id);
  }

  dispose(): void {
    this.disposed = true;
    for (const h of this.hosts.values()) h.dispose();
    this.hosts.clear();
  }

  private register(host: LeagueHost): void {
    this.hosts.set(host.id, host);
    for (const l of this.hostListeners) l(host);
  }

  private hooks() {
    return {
      onChange: (league: League, events: DomainEvent[]) => {
        this.repo.save(league);
        const host = this.hosts.get(league.id);
        if (host) for (const l of this.listeners) l(host, events);
      },
      onResults: (league: League, results: Parameters<LeagueRepository['saveResults']>[1]) => {
        this.repo.saveResults(league, results);
      },
    };
  }
}
