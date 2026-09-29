import type { BotArchetype, CatalogItem, League, MatchResult, MatchSummary, TalkPhrase, TalkTone, TeamLogo, TeamTalk } from '../domain/types';
import { DomainError } from '../domain/errors';
import type { LeagueConfigInput } from '../domain/config';
import type { DomainEvent } from '../events/types';
import { EventBus } from '../events/eventBus';
import { AuctionEngine } from '../auction/auctionEngine';
import type { BidRequest } from '../auction/bidValidation';
import { Catalog } from '../catalog/catalog';
import { botReactionDelay, decideBotBid } from '../bots/botBrain';
import { LeagueCommands, type Participant } from './commands';
import { projectLeague, projectMatch, type LeagueView, type MatchView } from './projection';
import type { Scheduler, TimerHandle } from './scheduler';
import { simulateMatch, type MatchSide } from '../match/matchEngine';
import { createNarrator } from '../commentary/narrator';
import { TeamTalks } from '../match/teamTalk';
import { TournamentEngine } from '../tournament/tournamentEngine';
import { computeStandings, formScore } from '../tournament/standings';
import { computeAwards } from '../stats/awards';
import { computeStatistics, type SeasonStatistics } from '../stats/statistics';
import { comment, matchFeed, postFeed, purchaseFeed, react } from '../social/feed';
import { createRng, hashString, type Rng } from '../util/rng';

/** Delay between "Gioca giornata" and kickoff, so every client can open the Match Center. */
export const KICKOFF_DELAY_MS = 2500;

export interface HostHooks {
  /** called after every accepted state change, with the events it produced */
  onChange?(league: League, events: DomainEvent[]): void;
  /** called when new match results are produced (persistence) */
  onResults?(league: League, results: MatchResult[]): void;
}

export interface HostOptions {
  scheduler: Scheduler;
  /** master seed of the host RNG; derived from the league id when omitted */
  seed?: number;
  hooks?: HostHooks;
  /** bots can be disabled (tests of pure human flows) */
  botsEnabled?: boolean;
}

/**
 * LeagueHost — authoritative runtime of one league.
 *
 * Every command runs synchronously and to completion before the next one
 * (JavaScript is single threaded and the host never awaits in the middle of a
 * transition): commands are therefore serialised per league and two concurrent
 * bids can never interleave. Timers (lot expiry, next lot, bots, live matches)
 * are re-armed from the state after every change, so the host can be rebuilt
 * from persisted state at any time (server restart, reconnect).
 */
export class LeagueHost {
  readonly bus = new EventBus();
  private league: League;
  private readonly results = new Map<string, MatchResult>();
  private readonly scheduler: Scheduler;
  private readonly rng: Rng;
  private readonly hooks: HostHooks;
  private readonly botsEnabled: boolean;
  private lotTimer: TimerHandle | null = null;
  private nextLotTimer: TimerHandle | null = null;
  private matchTimer: TimerHandle | null = null;
  private botTimers = new Map<string, TimerHandle>();
  private botSignature = '';
  private disposed = false;

  constructor(league: League, results: MatchResult[], opts: HostOptions) {
    this.league = league;
    for (const r of results) this.results.set(r.matchId, r);
    this.scheduler = opts.scheduler;
    this.rng = createRng(opts.seed ?? hashString(`${league.id}:${league.season}:${league.version}`));
    this.hooks = opts.hooks ?? {};
    this.botsEnabled = opts.botsEnabled ?? true;
    this.syncTimers();
  }

  static create(args: { id: string; code: string; config: LeagueConfigInput; master: Participant }, opts: HostOptions): LeagueHost {
    const rng = createRng(opts.seed ?? hashString(args.id));
    const { league, events } = LeagueCommands.create({ ...args, now: opts.scheduler.now(), rng });
    const host = new LeagueHost(league, [], opts);
    host.hooks.onChange?.(league, events);
    return host;
  }

  get state(): Readonly<League> {
    return this.league;
  }

  get id(): string {
    return this.league.id;
  }

  now(): number {
    return this.scheduler.now();
  }

  dispose(): void {
    this.disposed = true;
    this.clearAuctionTimers();
    this.scheduler.clearTimeout(this.matchTimer);
  }

  // ───────────────────────────── queries

  view(userId: string): LeagueView {
    return projectLeague(this.league, userId, this.now());
  }

  isMember(userId: string): boolean {
    return this.league.members.some((m) => m.userId === userId);
  }

  teamOf(userId: string): string | null {
    return this.league.members.find((m) => m.userId === userId)?.teamId ?? null;
  }

  matchView(matchId: string): MatchView {
    const m = this.league.tournament?.matches.find((x) => x.id === matchId);
    if (!m) throw new DomainError('NOT_FOUND');
    return projectMatch(this.league, m, this.results.get(matchId), this.now());
  }

  statistics(): SeasonStatistics {
    const matches = this.league.tournament?.matches ?? [];
    const finished = matches.filter((m) => m.status === 'finished');
    return computeStatistics(finished.map((m) => this.results.get(m.id)).filter((r): r is MatchResult => !!r), matches);
  }

  allResults(): MatchResult[] {
    return [...this.results.values()];
  }

  // ───────────────────────────── commands

  join(p: Participant): void {
    this.run(() => LeagueCommands.join(this.league, p, this.now(), this.rng));
  }

  leave(userId: string, byUserId = userId): void {
    this.run(() => LeagueCommands.leave(this.league, userId, byUserId));
  }

  setReady(userId: string, ready: boolean): void {
    this.run(() => LeagueCommands.setReady(this.league, userId, ready));
  }

  updateConfig(userId: string, input: LeagueConfigInput): void {
    this.run(() => LeagueCommands.updateConfig(this.league, userId, input));
  }

  updateTeam(userId: string, patch: { name?: string; logo?: TeamLogo }): void {
    this.run(() => LeagueCommands.updateTeam(this.league, userId, patch));
  }

  addBots(userId: string, archetypes: BotArchetype[]): void {
    this.run(() => LeagueCommands.addBots(this.league, userId, archetypes, this.now(), this.rng));
  }

  addCustomItems(userId: string, items: CatalogItem[], feedText?: string): void {
    this.run(() => {
      const events = LeagueCommands.addCustomItems(this.league, userId, items);
      if (feedText) events.push(postFeed(this.league, 'ai_players', '🤖', feedText, this.now()));
      return events;
    });
  }

  removeCustomItem(userId: string, itemId: string): void {
    this.run(() => LeagueCommands.removeCustomItem(this.league, userId, itemId));
  }

  startAuction(userId: string): void {
    this.run(() => this.withAuctionFeed(LeagueCommands.startAuction(this.league, userId, this.now(), this.rng)));
  }

  /**
   * Place a bid for the user's team. The user can only bid for his own team:
   * the team id is derived server side, never taken from the client.
   */
  placeBid(userId: string, req: Omit<BidRequest, 'teamId'>): { duplicate: boolean; amount: number } {
    const teamId = this.teamOf(userId);
    if (!teamId) throw new DomainError('FORBIDDEN');
    let duplicate = false;
    this.run(() => {
      const res = AuctionEngine.placeBid(this.league, { ...req, teamId }, this.now());
      duplicate = res.duplicate;
      return res.events;
    });
    return { duplicate, amount: this.league.auction.currentLot?.currentBid ?? req.amount };
  }

  pauseAuction(userId: string): void {
    this.requireMaster(userId);
    this.run(() => AuctionEngine.pause(this.league, this.now()));
  }

  resumeAuction(userId: string): void {
    this.requireMaster(userId);
    this.run(() => AuctionEngine.resume(this.league, this.now()));
  }

  startSeason(userId: string): void {
    this.run(() => LeagueCommands.startSeason(this.league, userId, this.now(), this.rng));
  }

  /**
   * Simulate the next round. `live`: everyone watches the shared live timeline
   * and results are published at the final whistle. `instant`: results now.
   */
  playRound(userId: string, mode: 'live' | 'instant' = 'live'): MatchSummary[] {
    this.requireMaster(userId);
    const t = this.league.tournament;
    if (this.league.status !== 'season' || !t) throw new DomainError('INVALID_STATE');
    if (t.matches.some((m) => m.status === 'live')) throw new DomainError('INVALID_STATE', 'Giornata già in corso');
    const round = TournamentEngine.pendingRound(t);
    if (!round.length) throw new DomainError('INVALID_STATE');

    const produced: MatchResult[] = [];
    this.run(() => {
      const now = this.now();
      const events: DomainEvent[] = [];
      const kickoffAt = mode === 'live' ? now + KICKOFF_DELAY_MS : now;
      TeamTalks.giveBotTalks(this.league, round, now);
      for (const m of round) {
        const result = this.simulate(m);
        this.results.set(m.id, result);
        produced.push(result);
        m.status = 'live';
        m.kickoffAt = kickoffAt;
        events.push({ type: 'MatchStarted', matchId: m.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, kickoffAt });
      }
      if (mode === 'instant') events.push(...this.finishLiveMatches());
      return events;
    });
    this.hooks.onResults?.(this.league, produced);
    return round;
  }

  /** Pre-match talk to the user's own team (important matches only, once per match). */
  giveTeamTalk(userId: string, matchId: string, phrase: TalkPhrase, tone: TalkTone): TeamTalk {
    const teamId = this.teamOf(userId);
    if (!teamId) throw new DomainError('FORBIDDEN');
    let talk: TeamTalk | null = null;
    this.run(() => {
      talk = TeamTalks.give(this.league, teamId, matchId, phrase, tone, this.now());
      return [];
    });
    return talk!;
  }

  newSeason(userId: string): void {
    this.run(() => LeagueCommands.newSeason(this.league, userId));
    this.results.clear();
  }

  react(userId: string, feedId: string, emoji: string): void {
    this.requireMemberId(userId);
    this.run(() => {
      react(this.league, feedId, userId, emoji);
      return [];
    });
  }

  comment(userId: string, feedId: string, text: string): void {
    this.requireMemberId(userId);
    this.run(() => {
      comment(this.league, feedId, userId, text, this.now());
      return [];
    });
  }

  chat(userId: string, text: string): void {
    const m = this.requireMemberId(userId);
    const clean = text.trim().slice(0, 200);
    if (!clean) throw new DomainError('INVALID_INPUT');
    this.run(() => [postFeed(this.league, 'chat', m.avatar, `${m.displayName}: ${clean}`, this.now())]);
  }

  /** Presence: does not bump the version for bots, it is cheap to call on every (dis)connection. */
  setConnected(userId: string, connected: boolean): void {
    const m = this.league.members.find((x) => x.userId === userId);
    if (!m || m.connected === connected) return;
    this.run(() => {
      m.connected = connected;
      return [];
    });
  }

  // ───────────────────────────── internals

  private run(fn: () => DomainEvent[]): void {
    if (this.disposed) throw new DomainError('INVALID_STATE', 'League host disposed');
    const events = fn();
    this.league.version += 1;
    for (const e of events) this.bus.emit(e);
    this.syncTimers();
    this.hooks.onChange?.(this.league, events);
  }

  private requireMaster(userId: string): void {
    if (!this.league.members.find((m) => m.userId === userId)?.isMaster) throw new DomainError('FORBIDDEN');
  }

  private requireMemberId(userId: string) {
    const m = this.league.members.find((x) => x.userId === userId);
    if (!m) throw new DomainError('FORBIDDEN');
    return m;
  }

  /** Adds the social feed lines that auction events deserve. */
  private withAuctionFeed(events: DomainEvent[]): DomainEvent[] {
    const out = [...events];
    for (const e of events) {
      if (e.type === 'PlayerSold') {
        const f = purchaseFeed(this.league, e.result, this.now());
        if (f) out.push(f);
      }
      if (e.type === 'AuctionCompleted') {
        out.push(postFeed(this.league, 'auction_completed', '🏁', 'Asta conclusa! Tutte le rose sono complete: si va in campo', this.now()));
      }
    }
    return out;
  }

  private clearAuctionTimers(): void {
    this.scheduler.clearTimeout(this.lotTimer);
    this.scheduler.clearTimeout(this.nextLotTimer);
    this.lotTimer = this.nextLotTimer = null;
    for (const h of this.botTimers.values()) this.scheduler.clearTimeout(h);
    this.botTimers.clear();
    this.botSignature = '';
  }

  /** Re-arm every timer from the current state (idempotent). */
  private syncTimers(): void {
    if (this.disposed) return;
    const a = this.league.auction;
    const now = this.now();

    this.scheduler.clearTimeout(this.lotTimer);
    this.scheduler.clearTimeout(this.nextLotTimer);
    this.lotTimer = this.nextLotTimer = null;

    if (this.league.status === 'auction' && a.status === 'lot_open' && a.currentLot) {
      this.lotTimer = this.scheduler.setTimeout(() => this.onLotTimer(), a.currentLot.endsAt - now);
      this.scheduleBots();
    } else {
      for (const h of this.botTimers.values()) this.scheduler.clearTimeout(h);
      this.botTimers.clear();
      this.botSignature = '';
    }
    if (this.league.status === 'auction' && a.status === 'lot_sold' && a.nextLotAt !== null) {
      this.nextLotTimer = this.scheduler.setTimeout(() => this.onNextLotTimer(), a.nextLotAt - now);
    }

    this.scheduler.clearTimeout(this.matchTimer);
    this.matchTimer = null;
    const live = this.league.tournament?.matches.filter((m) => m.status === 'live') ?? [];
    if (live.length) {
      const end = Math.max(...live.map((m) => (m.kickoffAt ?? now) + this.league.config.liveMatchSeconds * 1000));
      this.matchTimer = this.scheduler.setTimeout(() => this.onMatchTimer(), end - now);
    }
  }

  private onLotTimer(): void {
    this.lotTimer = null;
    const lot = this.league.auction.currentLot;
    if (!lot || this.now() < lot.endsAt) return this.syncTimers();
    this.run(() => this.withAuctionFeed(AuctionEngine.closeLot(this.league, this.now())));
  }

  private onNextLotTimer(): void {
    this.nextLotTimer = null;
    if (this.league.auction.status !== 'lot_sold') return;
    this.run(() => this.withAuctionFeed(AuctionEngine.openNextLot(this.league, this.now())));
  }

  private onMatchTimer(): void {
    this.matchTimer = null;
    this.run(() => this.finishLiveMatches());
  }

  /** Bots re-think whenever the lot changes (new lot or new bid). */
  private scheduleBots(): void {
    if (!this.botsEnabled) return;
    const lot = this.league.auction.currentLot!;
    const signature = `${lot.id}:${lot.bids.length}`;
    if (signature === this.botSignature) return;
    this.botSignature = signature;
    for (const h of this.botTimers.values()) this.scheduler.clearTimeout(h);
    this.botTimers.clear();
    const catalog = new Catalog(this.league.customItems);
    for (const m of this.league.members) {
      if (!m.bot || m.teamId === lot.leaderTeamId) continue;
      const delay = botReactionDelay(m, this.rng, lot.endsAt - this.now());
      if (delay === null) continue;
      this.botTimers.set(
        m.userId,
        this.scheduler.setTimeout(() => {
          this.botTimers.delete(m.userId);
          const decision = decideBotBid(m, this.league, catalog, this.rng);
          if (!decision) return;
          try {
            this.placeBid(m.userId, { lotId: lot.id, amount: decision.amount, bidId: `${m.userId}:${lot.id}:${lot.bids.length}` });
          } catch {
            // lost the race against a human or the timer: that's the auction
          }
        }, delay),
      );
    }
  }

  private matchSide(teamId: string, m: MatchSummary): MatchSide {
    const catalog = new Catalog(this.league.customItems);
    const team = this.league.teams.find((t) => t.id === teamId)!;
    const players = team.roster.filter((r) => r.kind === 'player').map((r) => catalog.player(r.itemId));
    const coachId = team.roster.find((r) => r.kind === 'coach')?.itemId;
    const row = this.league.standings.find((r) => r.teamId === teamId);
    const last = row?.form[row.form.length - 1];
    return {
      team,
      players,
      coach: coachId ? catalog.coach(coachId) : null,
      form: formScore(row),
      morale: last === 'W' ? 1 : last === 'L' ? -1 : 0,
      talk: m.talks?.find((t) => t.teamId === teamId),
    };
  }

  private simulate(m: MatchSummary): MatchResult {
    return simulateMatch({
      matchId: m.id,
      seed: m.seed,
      home: this.matchSide(m.homeTeamId, m),
      away: this.matchSide(m.awayTeamId, m),
      homeAdvantage: this.league.config.homeAway && m.stage !== 'final',
      knockout: TournamentEngine.isKnockout(m),
      narrator: createNarrator(this.league.config.commentaryTone, m.seed),
    });
  }

  private finishLiveMatches(): DomainEvent[] {
    const t = this.league.tournament;
    if (!t) return [];
    const now = this.now();
    const events: DomainEvent[] = [];
    const previousLeader = this.league.standings[0]?.teamId ?? null;
    for (const m of t.matches.filter((x) => x.status === 'live')) {
      const r = this.results.get(m.id);
      if (!r) continue;
      m.status = 'finished';
      m.homeGoals = r.homeGoals;
      m.awayGoals = r.awayGoals;
      m.homePens = r.homePens;
      m.awayPens = r.awayPens;
      m.mvpPlayerId = r.mvpPlayerId;
      events.push({ type: 'MatchEnded', matchId: m.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeGoals: r.homeGoals, awayGoals: r.awayGoals });
      events.push(matchFeed(this.league, m, now));
    }
    const finishedRound = Math.max(0, ...t.matches.filter((m) => m.status === 'finished').map((m) => m.round));
    this.league.standings = computeStandings(this.league.teams.map((x) => x.id), t.matches, t.groups);
    events.push({ type: 'RoundCompleted', round: finishedRound });

    const leader = this.league.standings[0]?.teamId ?? null;
    const regularRunning = t.phase === 'regular' && !t.groups;
    if (regularRunning && leader && leader !== previousLeader && this.league.standings[0].played > 0) {
      const name = this.league.teams.find((x) => x.id === leader)!.name;
      events.push(postFeed(this.league, 'leader', '🏆', `${name} è primo in classifica`, now));
    }

    const { completed } = TournamentEngine.advance(this.league, this.rng);
    if (completed) events.push(...this.completeSeason());
    return events;
  }

  private completeSeason(): DomainEvent[] {
    const t = this.league.tournament!;
    const now = this.now();
    const results = t.matches.map((m) => this.results.get(m.id)).filter((r): r is MatchResult => !!r);
    this.league.awards = computeAwards(this.league, results);
    this.league.status = 'completed';
    LeagueCommands.archiveSeason(this.league, now, seasonRecords(this.league, results));
    const champion = this.league.teams.find((x) => x.id === t.championTeamId);
    return [
      { type: 'TournamentCompleted', championTeamId: t.championTeamId },
      postFeed(this.league, 'champion', '🏆', `${champion?.name ?? 'Nessuno'} è CAMPIONE della stagione ${this.league.season}!`, now),
    ];
  }
}

function seasonRecords(league: League, results: MatchResult[]): { label: string; value: string }[] {
  const t = league.tournament!;
  const name = (id: string) => league.teams.find((x) => x.id === id)?.name ?? '—';
  const records: { label: string; value: string }[] = [];
  const finished = t.matches.filter((m) => m.status === 'finished');
  const margin = (m: MatchSummary) => Math.abs((m.homeGoals ?? 0) - (m.awayGoals ?? 0));
  const biggest = finished.reduce<MatchSummary | null>((b, m) => (!b || margin(m) > margin(b) ? m : b), null);
  if (biggest) records.push({ label: 'Vittoria più larga', value: `${name(biggest.homeTeamId)} ${biggest.homeGoals}-${biggest.awayGoals} ${name(biggest.awayTeamId)}` });
  const goals = (m: MatchSummary) => (m.homeGoals ?? 0) + (m.awayGoals ?? 0);
  const wildest = finished.reduce<MatchSummary | null>((b, m) => (!b || goals(m) > goals(b) ? m : b), null);
  if (wildest) records.push({ label: 'Partita con più gol', value: `${name(wildest.homeTeamId)} ${wildest.homeGoals}-${wildest.awayGoals} ${name(wildest.awayTeamId)}` });
  const totalGoals = results.reduce((s, r) => s + r.homeGoals + r.awayGoals, 0);
  records.push({ label: 'Gol totali', value: String(totalGoals) });
  const priciest = league.auction.results.filter((r) => r.teamId).sort((a, b) => b.price - a.price)[0];
  if (priciest) {
    const catalog = new Catalog(league.customItems);
    records.push({ label: 'Acquisto più caro', value: `${catalog.find(priciest.itemId)?.name ?? priciest.itemId} (${priciest.price})` });
  }
  return records;
}
