import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Catalog,
  createCustomPlayer,
  createRealScheduler,
  createRng,
  DomainError,
  ERROR_MESSAGES_IT,
  generateInviteCode,
  LeagueHost,
  offlineGenerate,
  parseGenerationPrompt,
  randomSeed,
  type CatalogItem,
  type DomainEvent,
  type League,
  type MatchResult,
  type MatchView,
  type SeasonStatistics,
} from '@asta/core';
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

const STORAGE_KEY = 'asta.local.leagues.v1';
const MAX_SAVED = 4;

interface Saved {
  league: League;
  results: MatchResult[];
}

/**
 * Offline client for the Demo Mode: the same authoritative LeagueHost used by
 * the server runs on the device, with bots as opponents. Leagues are saved to
 * AsyncStorage so a demo survives an app restart.
 */
export class LocalClient implements GameClient {
  readonly mode = 'local' as const;
  private readonly hosts = new Map<string, LeagueHost>();
  private readonly subs = new Map<string, Set<LeagueSubscription>>();
  private readonly notif = new Set<(n: AppNotification) => void>();
  private readonly scheduler = createRealScheduler();
  private readonly pending = new Map<string, CatalogItem[]>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded: Promise<void>;

  constructor(
    readonly userId: string,
    /** read at use time: the profile can change after the client is created */
    private readonly profile: () => { displayName: string; avatar: string },
  ) {
    this.loaded = this.restore();
  }

  serverNow(): number {
    return Date.now();
  }

  onConnection(listener: (s: ConnectionStatus) => void): () => void {
    listener('online');
    return () => {};
  }

  onNotification(listener: (n: AppNotification) => void): () => void {
    this.notif.add(listener);
    return () => this.notif.delete(listener);
  }

  async listLeagues(): Promise<LeagueSummary[]> {
    await this.loaded;
    return [...this.hosts.values()]
      .map((h) => ({
        id: h.id,
        name: h.state.config.name,
        code: h.state.code,
        status: h.state.status,
        season: h.state.season,
        members: h.state.members.length,
        updatedAt: h.state.feed[0]?.at ?? h.state.createdAt,
        won: wonBy(h.state, this.userId),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async createLeague(input: Parameters<GameClient['createLeague']>[0]) {
    await this.loaded;
    const rng = createRng(randomSeed());
    const id = `local-${Date.now().toString(36)}`;
    const host = this.wrap(
      LeagueHost.create(
        { id, code: generateInviteCode(rng), config: input.config, master: { userId: this.userId, ...this.profile(), teamName: input.teamName, logo: input.logo } },
        { scheduler: this.scheduler, seed: randomSeed(), hooks: this.hooks() },
      ),
    );
    this.persistSoon();
    return host.view(this.userId);
  }

  async invitePreview(): Promise<InvitePreview> {
    throw new ClientError('OFFLINE', 'In modalità demo non puoi entrare in leghe di altri');
  }

  async joinLeague(): Promise<never> {
    throw new ClientError('OFFLINE', 'In modalità demo non puoi entrare in leghe di altri');
  }

  subscribe(leagueId: string, sub: LeagueSubscription): () => void {
    let set = this.subs.get(leagueId);
    if (!set) this.subs.set(leagueId, (set = new Set()));
    set.add(sub);
    void this.loaded.then(() => {
      const host = this.hosts.get(leagueId);
      if (host) sub.onState(host.view(this.userId));
    });
    return () => set!.delete(sub);
  }

  async command<K extends CommandName>(leagueId: string, name: K, payload: CommandMap[K]): Promise<unknown> {
    const host = await this.host(leagueId);
    const p = payload as Record<string, never> & CommandMap[K];
    return this.guard(() => {
      const u = this.userId;
      switch (name) {
        case 'lobby:ready': return host.setReady(u, (p as CommandMap['lobby:ready']).ready);
        case 'lobby:config': return host.updateConfig(u, (p as CommandMap['lobby:config']).config);
        case 'lobby:team': return host.updateTeam(u, p as CommandMap['lobby:team']);
        case 'lobby:addBots': return host.addBots(u, (p as CommandMap['lobby:addBots']).archetypes);
        case 'lobby:kick': return host.leave((p as CommandMap['lobby:kick']).userId, u);
        case 'lobby:leave': return host.leave(u);
        case 'auction:start': return host.startAuction(u);
        case 'auction:bid': return host.placeBid(u, p as CommandMap['auction:bid']);
        case 'auction:pause': return host.pauseAuction(u);
        case 'auction:resume': return host.resumeAuction(u);
        case 'season:start': return host.startSeason(u);
        case 'round:play': return host.playRound(u, (p as CommandMap['round:play']).mode).map((m) => m.id);
        case 'season:new': return host.newSeason(u);
        case 'round:finish': return host.finishLiveRound(u);
        case 'match:talk': {
          const { matchId, phrase, tone } = p as CommandMap['match:talk'];
          return host.giveTeamTalk(u, matchId, phrase, tone);
        }
        case 'feed:react': return host.react(u, (p as CommandMap['feed:react']).feedId, (p as CommandMap['feed:react']).emoji);
        case 'feed:comment': return host.comment(u, (p as CommandMap['feed:comment']).feedId, (p as CommandMap['feed:comment']).text);
        case 'feed:chat': return host.chat(u, (p as CommandMap['feed:chat']).text);
      }
    });
  }

  async getMatch(leagueId: string, matchId: string): Promise<MatchView> {
    const host = await this.host(leagueId);
    // single player: the whole timeline, so playback can run faster than the live clock
    return this.guard(() => host.matchView(matchId, { revealAll: true }));
  }

  async getStats(leagueId: string): Promise<SeasonStatistics> {
    return (await this.host(leagueId)).statistics();
  }

  async generatePlayers(leagueId: string, prompt: string): Promise<GenerationPreview> {
    const host = await this.host(leagueId);
    const request = parseGenerationPrompt(prompt);
    const items = offlineGenerate(request, new Set(host.state.customItems.map((i) => i.id)));
    const generationId = `gen-${Date.now()}`;
    this.pending.set(generationId, items);
    return { generationId, source: 'offline', note: 'Modalità demo: selezione dal database curato', rejected: 0, request, items };
  }

  async confirmGeneration(leagueId: string, generationId: string, itemIds?: string[]): Promise<number> {
    const host = await this.host(leagueId);
    const items = (this.pending.get(generationId) ?? []).filter((i) => !itemIds || itemIds.includes(i.id));
    this.guard(() => host.addCustomItems(this.userId, items, `${items.length} nuovi campioni aggiunti al database della lega`));
    this.pending.delete(generationId);
    return items.length;
  }

  async addCustomPlayer(leagueId: string, input: Parameters<GameClient['addCustomPlayer']>[1]): Promise<CatalogItem> {
    const host = await this.host(leagueId);
    const item = this.guard(() => createCustomPlayer(input));
    this.guard(() => host.addCustomItems(this.userId, [item]));
    return item;
  }

  async removeCustomItem(leagueId: string, itemId: string): Promise<void> {
    const host = await this.host(leagueId);
    this.guard(() => host.removeCustomItem(this.userId, itemId));
  }

  dispose(): void {
    for (const h of this.hosts.values()) h.dispose();
    this.hosts.clear();
    this.subs.clear();
  }

  // ── internals

  private async host(id: string): Promise<LeagueHost> {
    await this.loaded;
    const h = this.hosts.get(id);
    if (!h) throw new ClientError('NOT_FOUND', 'Lega non trovata');
    return h;
  }

  private guard<T>(fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      if (err instanceof DomainError) throw new ClientError(err.code, err.message !== err.code ? err.message : ERROR_MESSAGES_IT[err.code]);
      throw err;
    }
  }

  private hooks() {
    return {
      onChange: (league: League, events: DomainEvent[]) => {
        const host = this.hosts.get(league.id);
        if (!host) return;
        const view = host.view(this.userId);
        for (const s of this.subs.get(league.id) ?? []) {
          s.onState(view);
          if (events.length) s.onEvents?.(events);
        }
        this.notify(host, events);
        this.persistSoon();
      },
    };
  }

  private wrap(host: LeagueHost): LeagueHost {
    this.hosts.set(host.id, host);
    return host;
  }

  /** Local equivalent of the server's notification service (in-app toasts). */
  private notify(host: LeagueHost, events: DomainEvent[]) {
    const league = host.state;
    const myTeam = league.teams.find((t) => t.ownerId === this.userId)?.id;
    const catalog = new Catalog(league.customItems);
    const teamName = (id: string | null) => league.teams.find((t) => t.id === id)?.name ?? '';
    const emit = (n: Omit<AppNotification, 'leagueId'>) => this.notif.forEach((l) => l({ ...n, leagueId: league.id }));
    for (const e of events) {
      if (e.type === 'Outbid' && e.teamId === myTeam) emit({ kind: 'outbid', title: 'Sei stato superato! 😱', body: `${teamName(e.byTeamId)} offre ${e.amount} per ${catalog.find(e.itemId)?.name ?? ''}` });
      if (e.type === 'MatchEnded' && (e.homeTeamId === myTeam || e.awayTeamId === myTeam)) {
        const [gf, ga] = e.homeTeamId === myTeam ? [e.homeGoals, e.awayGoals] : [e.awayGoals, e.homeGoals];
        emit({ kind: 'match_result', title: gf > ga ? `Hai vinto ${gf}-${ga}! 🎉` : gf < ga ? `Hai perso ${gf}-${ga} 😤` : `Pareggio ${gf}-${ga} 🤝`, body: `${teamName(e.homeTeamId)} - ${teamName(e.awayTeamId)}` });
      }
      if (e.type === 'TournamentCompleted') emit({ kind: 'champion', title: '🏆 Abbiamo un campione!', body: `${teamName(e.championTeamId)} vince ${league.config.name}` });
    }
  }

  private persistSoon() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), 800);
  }

  private async persist() {
    const all = [...this.hosts.values()].sort((a, b) => (b.state.feed[0]?.at ?? 0) - (a.state.feed[0]?.at ?? 0)).slice(0, MAX_SAVED);
    const saved: Saved[] = all.map((h) => ({ league: h.state as League, results: h.allResults() }));
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage full: demo keeps running in memory */
    }
  }

  private async restore() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      for (const s of JSON.parse(raw) as Saved[]) {
        this.wrap(new LeagueHost(s.league, s.results, { scheduler: this.scheduler, seed: randomSeed(), hooks: this.hooks() }));
      }
    } catch {
      /* corrupted storage: start fresh */
    }
  }
}

/** The user's team won the title of the current season, or of any archived one. */
function wonBy(league: League, userId: string): boolean {
  const teamId = league.members.find((m) => m.userId === userId)?.teamId;
  if (!teamId) return false;
  if (league.status === 'completed' && league.tournament?.championTeamId === teamId) return true;
  return league.history.some((h) => h.championTeamId === teamId);
}
