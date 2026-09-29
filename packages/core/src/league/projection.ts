import type {
  AuctionState,
  CatalogItem,
  League,
  Lot,
  MatchEvent,
  MatchLineup,
  MatchResult,
  MatchSummary,
  PlayerMatchStats,
  Position,
  Slot,
  Team,
  TeamLogo,
  TeamMatchStats,
} from '../domain/types';
import { Catalog, countBySlot } from '../catalog/catalog';
import { maxBid } from '../economy/budget';
import { slotNeeds, type SlotNeeds } from '../team/teamValidation';
import { minimumNextBid } from '../auction/bidValidation';
import { talkOffer, type TalkOffer } from '../match/teamTalk';

/**
 * What a given user is allowed to see of a league.
 *
 * The auction queue (next items) is NEVER sent. Other teams' credits, rosters and
 * bidder identities are hidden according to the Master's visibility rules.
 */
export interface TeamView extends Omit<Team, 'credits' | 'roster'> {
  /** null when hidden by the rules */
  credits: number | null;
  roster: Team['roster'] | null;
  rosterCount: number;
  needs: SlotNeeds;
  maxBid: number | null;
}

export interface LotView extends Omit<Lot, 'leaderTeamId' | 'bids'> {
  leaderTeamId: string | null;
  /** true when someone leads but the rules hide who */
  leaderHidden: boolean;
  bids: { id: string; teamId: string | null; amount: number; at: number }[];
  minNextBid: number;
}

export interface AuctionView extends Omit<AuctionState, 'queue' | 'unsold' | 'processedBidIds' | 'currentLot'> {
  currentLot: LotView | null;
  /** items still to be auctioned, per slot (the identity of the next one stays secret) */
  remaining: Record<Slot, number>;
  remainingTotal: number;
}

export interface LeagueView extends Omit<League, 'auction' | 'teams' | 'customItems'> {
  auction: AuctionView;
  teams: TeamView[];
  /** custom / AI items referenced by this league (the client has the seed catalog) */
  customItems: CatalogItem[];
  viewerId: string;
  serverNow: number;
  /** the viewer's pending dressing-room talk (next round, important match), if any */
  teamTalk: TalkOffer | null;
}

export function projectLeague(league: League, viewerId: string, now: number): LeagueView {
  const viewerTeamId = league.members.find((m) => m.userId === viewerId)?.teamId ?? null;
  const { visibility } = league.config;
  const auctionOngoing = league.status === 'lobby' || league.status === 'auction';
  const catalog = new Catalog(league.customItems);

  const teams: TeamView[] = league.teams.map((t) => {
    const mine = t.id === viewerTeamId;
    const showCredits = mine || visibility.othersCredits || !auctionOngoing;
    const showRoster = mine || visibility.othersRosters || !auctionOngoing;
    return {
      id: t.id,
      name: t.name,
      ownerId: t.ownerId,
      logo: t.logo,
      credits: showCredits ? t.credits : null,
      roster: showRoster ? t.roster : null,
      rosterCount: t.roster.length,
      needs: slotNeeds(t, league.config),
      maxBid: showCredits ? maxBid(t, league.config) : null,
    };
  });

  const a = league.auction;
  const lot = a.currentLot;
  const hideBidders = !visibility.bidderNames;
  const lotView: LotView | null = lot
    ? {
        ...lot,
        leaderTeamId: hideBidders && lot.leaderTeamId !== viewerTeamId ? null : lot.leaderTeamId,
        leaderHidden: hideBidders && !!lot.leaderTeamId && lot.leaderTeamId !== viewerTeamId,
        bids: lot.bids.slice(-30).map((b) => ({ id: b.id, teamId: hideBidders && b.teamId !== viewerTeamId ? null : b.teamId, amount: b.amount, at: b.at })),
        minNextBid: minimumNextBid(lot, league),
      }
    : null;

  const remainingIds = [...a.queue, ...a.unsold];
  const { queue: _q, unsold: _u, processedBidIds: _p, currentLot: _c, ...publicAuction } = a;
  const auction: AuctionView = {
    ...publicAuction,
    currentLot: lotView,
    // blind auction: during the auction you only know what you bought yourself
    results: hideBidders && auctionOngoing ? a.results.map((r) => (r.teamId === viewerTeamId ? r : { ...r, teamId: null })) : a.results,
    lastResult: hideBidders && auctionOngoing && a.lastResult && a.lastResult.teamId !== viewerTeamId ? { ...a.lastResult, teamId: null } : a.lastResult,
    remaining: countBySlot(remainingIds, catalog),
    remainingTotal: remainingIds.length,
  };

  // matches in progress never leak their final score through the snapshot
  const tournament = league.tournament
    ? {
        ...league.tournament,
        matches: league.tournament.matches.map((m) => {
          if (m.status === 'finished') return m;
          // before kickoff the opponent's talk is a secret
          const talks = m.status === 'scheduled' ? m.talks?.filter((t) => t.teamId === viewerTeamId) : m.talks;
          return { ...m, talks, homeGoals: null, awayGoals: null, homePens: null, awayPens: null, mvpPlayerId: null };
        }),
      }
    : null;

  return {
    ...league,
    // the pool is public (lobby preview) but sorted, so its order says nothing about the draw
    pool: [...league.pool].sort(),
    tournament,
    auction,
    teams,
    viewerId,
    serverNow: now,
    teamTalk: viewerTeamId ? talkOffer(league, viewerTeamId) : null,
  };
}

// ───────────────────────────── Match view ─────────────────────────────

export interface MatchTeamInfo {
  id: string;
  name: string;
  logo: TeamLogo;
  ownerName: string;
}

export interface MatchView {
  summary: MatchSummary;
  home: MatchTeamInfo;
  away: MatchTeamInfo;
  lineups: { home: MatchLineup; away: MatchLineup } | null;
  /** events revealed so far (all of them once finished) */
  events: MatchEvent[];
  totalTime: number;
  /** live timeline position (same unit as MatchEvent.t), null if not live */
  liveTime: number | null;
  liveMs: number;
  serverNow: number;
  final: {
    homeStats: TeamMatchStats;
    awayStats: TeamMatchStats;
    playerStats: PlayerMatchStats[];
    mvpPlayerId: string | null;
  } | null;
  players: Record<string, { name: string; position: Position; overall: number }>;
}

export function liveTimeAt(summary: MatchSummary, result: MatchResult, liveMs: number, now: number): number | null {
  if (summary.status !== 'live' || summary.kickoffAt === null) return null;
  const elapsed = Math.max(0, now - summary.kickoffAt);
  return Math.min(result.totalTime, (elapsed / liveMs) * result.totalTime);
}

/**
 * Anti-spoiler projection: while a match is live only the events that already
 * "happened" on the shared clock are sent; stats and ratings come at full time.
 */
export function projectMatch(league: League, summary: MatchSummary, result: MatchResult | undefined, now: number): MatchView {
  const info = (id: string): MatchTeamInfo => {
    const t = league.teams.find((x) => x.id === id)!;
    return { id, name: t.name, logo: t.logo, ownerName: league.members.find((m) => m.userId === t.ownerId)?.displayName ?? '—' };
  };
  const liveMs = league.config.liveMatchSeconds * 1000;
  const liveTime = result ? liveTimeAt(summary, result, liveMs, now) : null;
  const finished = summary.status === 'finished';
  const events = !result ? [] : finished ? result.events : liveTime === null ? [] : result.events.filter((e) => e.t <= liveTime);
  const players: MatchView['players'] = {};
  if (result) {
    for (const lu of [result.lineups.home, result.lineups.away]) for (const p of lu.players) players[p.playerId] = { name: p.name, position: p.position, overall: p.overall };
  }
  return {
    summary: finished ? summary : { ...summary, ...(summary.status === 'scheduled' ? { talks: undefined } : {}), homeGoals: null, awayGoals: null, homePens: null, awayPens: null, mvpPlayerId: null },
    home: info(summary.homeTeamId),
    away: info(summary.awayTeamId),
    lineups: result?.lineups ?? null,
    events,
    totalTime: result?.totalTime ?? 0,
    liveTime,
    liveMs,
    serverNow: now,
    final: finished && result ? { homeStats: result.homeStats, awayStats: result.awayStats, playerStats: result.playerStats, mvpPlayerId: result.mvpPlayerId } : null,
    players,
  };
}
