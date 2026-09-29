import { io, type Socket } from 'socket.io-client';
import type { CatalogItem, CustomPlayerInput, DomainEvent, LeagueView, MatchView, SeasonStatistics } from '@asta/core';
import {
  ClientError,
  type AppNotification,
  type CommandMap,
  type CommandName,
  type ConnectionStatus,
  type GameClient,
  type GenerationPreview,
  type InvitePreview,
  type LeagueSubscription,
  type LeagueSummary,
} from './types';

type Ack = { ok: true; data?: unknown } | { ok: false; error: string; message: string };

/**
 * Online client: REST for request/response, Socket.IO for everything realtime.
 *
 * Reconnection: socket.io retries with backoff; on every (re)connect the client
 * re-syncs the clock and re-subscribes to its leagues, receiving a full snapshot
 * (current lot, deadline, bids, feed…) so nothing that happened offline is lost.
 */
export class RemoteClient implements GameClient {
  readonly mode = 'remote' as const;
  private readonly socket: Socket;
  private offset = 0;
  private bestRtt = Infinity;
  private status: ConnectionStatus = 'connecting';
  private readonly connListeners = new Set<(s: ConnectionStatus) => void>();
  private readonly notifListeners = new Set<(n: AppNotification) => void>();
  private readonly subs = new Map<string, Set<LeagueSubscription>>();

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    readonly userId: string,
  ) {
    this.socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 8000,
    });
    this.socket.on('connect', () => {
      this.setStatus('online');
      void this.syncClock();
      for (const id of this.subs.keys()) void this.resubscribe(id);
    });
    this.socket.on('disconnect', () => this.setStatus('reconnecting'));
    this.socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'));
    this.socket.on('connect_error', () => this.setStatus(this.status === 'online' ? 'reconnecting' : 'offline'));
    this.socket.on('league:state', (view: LeagueView) => {
      this.observeServerTime(view.serverNow);
      for (const s of this.subs.get(view.id) ?? []) s.onState(view);
    });
    this.socket.on('league:events', (events: DomainEvent[]) => {
      for (const set of this.subs.values()) for (const s of set) s.onEvents?.(events);
    });
    this.socket.on('notification', (n: AppNotification) => this.notifListeners.forEach((l) => l(n)));
  }

  serverNow(): number {
    return Date.now() + this.offset;
  }

  onConnection(listener: (s: ConnectionStatus) => void): () => void {
    this.connListeners.add(listener);
    listener(this.status);
    return () => this.connListeners.delete(listener);
  }

  onNotification(listener: (n: AppNotification) => void): () => void {
    this.notifListeners.add(listener);
    return () => this.notifListeners.delete(listener);
  }

  async listLeagues(): Promise<LeagueSummary[]> {
    return (await this.http<{ leagues: LeagueSummary[] }>('GET', '/leagues')).leagues;
  }

  async createLeague(input: Parameters<GameClient['createLeague']>[0]): Promise<LeagueView> {
    return (await this.http<{ league: LeagueView }>('POST', '/leagues', input)).league;
  }

  async invitePreview(code: string): Promise<InvitePreview> {
    return this.http<InvitePreview>('GET', `/invite/${encodeURIComponent(code.trim().toUpperCase())}`);
  }

  async joinLeague(code: string, teamName?: string): Promise<LeagueView> {
    return (await this.http<{ league: LeagueView }>('POST', '/leagues/join', { code: code.trim().toUpperCase(), teamName })).league;
  }

  subscribe(leagueId: string, sub: LeagueSubscription): () => void {
    let set = this.subs.get(leagueId);
    const first = !set;
    if (!set) this.subs.set(leagueId, (set = new Set()));
    set.add(sub);
    if (first) void this.resubscribe(leagueId);
    else void this.emit<LeagueView>('league:subscribe', { leagueId }).then((v) => sub.onState(v)).catch(() => {});
    return () => {
      set!.delete(sub);
      if (set!.size === 0) {
        this.subs.delete(leagueId);
        this.socket.emit('league:unsubscribe', { leagueId });
      }
    };
  }

  command<K extends CommandName>(leagueId: string, name: K, payload: CommandMap[K]): Promise<unknown> {
    return this.emit(name, { leagueId, ...payload });
  }

  getMatch(leagueId: string, matchId: string): Promise<MatchView> {
    return this.emit<MatchView>('match:get', { leagueId, matchId }).then((m) => {
      this.observeServerTime(m.serverNow);
      return m;
    });
  }

  getStats(leagueId: string): Promise<SeasonStatistics> {
    return this.emit<SeasonStatistics>('stats:get', { leagueId });
  }

  generatePlayers(leagueId: string, prompt: string): Promise<GenerationPreview> {
    return this.http<GenerationPreview>('POST', `/leagues/${leagueId}/ai/generate`, { prompt });
  }

  async confirmGeneration(leagueId: string, generationId: string, itemIds?: string[]): Promise<number> {
    return (await this.http<{ added: number }>('POST', `/leagues/${leagueId}/ai/confirm`, { generationId, itemIds })).added;
  }

  async addCustomPlayer(leagueId: string, input: CustomPlayerInput): Promise<CatalogItem> {
    return (await this.http<{ item: CatalogItem }>('POST', `/leagues/${leagueId}/custom-players`, input)).item;
  }

  async removeCustomItem(leagueId: string, itemId: string): Promise<void> {
    await this.http('DELETE', `/leagues/${leagueId}/custom-players/${encodeURIComponent(itemId)}`);
  }

  dispose(): void {
    this.subs.clear();
    this.socket.disconnect();
  }

  // ── internals

  private setStatus(s: ConnectionStatus) {
    this.status = s;
    this.connListeners.forEach((l) => l(s));
  }

  private async resubscribe(leagueId: string) {
    try {
      const view = await this.emit<LeagueView>('league:subscribe', { leagueId });
      this.observeServerTime(view.serverNow);
      for (const s of this.subs.get(leagueId) ?? []) s.onState(view);
    } catch {
      /* will retry on next connect */
    }
  }

  /** NTP-like sync: keep the offset measured with the lowest round trip. */
  private async syncClock() {
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      try {
        const { serverNow } = await this.emit<{ serverNow: number }>('time:sync', {});
        const rtt = Date.now() - t0;
        if (rtt < this.bestRtt) {
          this.bestRtt = rtt;
          this.offset = serverNow + rtt / 2 - Date.now();
        }
      } catch {
        return;
      }
    }
  }

  private observeServerTime(serverNow: number) {
    // a snapshot can only be older than "now": if the server appears ahead of our estimate, move forward
    const estimate = serverNow - Date.now();
    if (!Number.isFinite(this.bestRtt) || estimate > this.offset + 250) this.offset = estimate;
  }

  private emit<T>(event: string, payload: unknown, timeoutMs = 8000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) return reject(new ClientError('OFFLINE', 'Connessione persa'));
      this.socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: Ack) => {
        if (err) return reject(new ClientError('TIMEOUT', 'Il server non risponde'));
        if (res.ok) resolve(res.data as T);
        else reject(new ClientError(res.error, res.message));
      });
    });
  }

  private async http<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers: { authorization: `Bearer ${this.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ClientError('OFFLINE', 'Server non raggiungibile');
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) throw new ClientError(data.error ?? String(res.status), data.message ?? 'Errore');
    return data as T;
  }
}

/** Guest sign-up against a server. */
export async function registerGuest(baseUrl: string, displayName: string, avatar: string): Promise<{ token: string; user: { id: string; displayName: string; avatar: string } }> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName, avatar }) });
  } catch {
    throw new ClientError('OFFLINE', 'Server non raggiungibile: controlla l\'indirizzo');
  }
  const data = await res.json();
  if (!res.ok) throw new ClientError(data.error, data.message);
  return data;
}

export async function updateRemoteProfile(baseUrl: string, token: string, patch: { displayName?: string; avatar?: string; pushToken?: string | null }): Promise<void> {
  await fetch(`${baseUrl}/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(patch) }).catch(() => {});
}
