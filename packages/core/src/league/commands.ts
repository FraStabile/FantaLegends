import type { BotArchetype, CatalogItem, League, LeagueConfig, Member, SeasonArchive, Team, TeamLogo } from '../domain/types';
import { DomainError } from '../domain/errors';
import { resolveConfig, type LeagueConfigInput } from '../domain/config';
import type { DomainEvent } from '../events/types';
import { AuctionEngine, createAuctionState } from '../auction/auctionEngine';
import { buildPool } from '../catalog/catalog';
import { TournamentEngine } from '../tournament/tournamentEngine';
import { computeStandings } from '../tournament/standings';
import { BOT_NAMES, BOT_PROFILES } from '../bots/botBrain';
import { postFeed } from '../social/feed';
import type { Rng } from '../util/rng';

export interface Participant {
  userId: string;
  displayName: string;
  avatar: string;
  teamName?: string;
  logo?: TeamLogo;
}

export const LOGO_EMOJIS = ['🦁', '🐺', '🦅', '🐉', '🦈', '🐂', '🦊', '🐍', '⚡', '🔥', '👑', '🚀', '🛡️', '🌪️', '🐝', '🦄'];
export const LOGO_COLORS = ['#D4AF37', '#3B82F6', '#EF4444', '#10B981', '#8B5CF6', '#F97316', '#06B6D4', '#EC4899', '#F5F5F5', '#84CC16'];

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateInviteCode(rng: Rng): string {
  return Array.from({ length: 6 }, () => rng.pick(CODE_ALPHABET.split(''))).join('');
}

function defaultTeamName(displayName: string, rng: Rng): string {
  const suffix = rng.pick(['FC', 'United', 'Calcio', 'Athletic', 'Legends', 'Club', '1899', 'Sporting']);
  return `${displayName} ${suffix}`.slice(0, 28);
}

function makeTeam(p: Participant, index: number, rng: Rng, startingCredits: number): Team {
  return {
    id: `t-${p.userId}`,
    name: (p.teamName?.trim() || defaultTeamName(p.displayName, rng)).slice(0, 28),
    ownerId: p.userId,
    logo: p.logo ?? { emoji: LOGO_EMOJIS[index % LOGO_EMOJIS.length], color: LOGO_COLORS[index % LOGO_COLORS.length] },
    credits: startingCredits,
    roster: [],
  };
}

function member(p: Participant, teamId: string, isMaster: boolean, bot: BotArchetype | null, now: number): Member {
  return {
    userId: p.userId,
    displayName: p.displayName.trim().slice(0, 20) || 'Giocatore',
    avatar: p.avatar || '⚽',
    teamId,
    isMaster,
    ready: bot !== null,
    connected: bot !== null,
    bot,
    joinedAt: now,
  };
}

function requireMaster(league: League, userId: string): void {
  if (!league.members.find((m) => m.userId === userId)?.isMaster) throw new DomainError('FORBIDDEN');
}

function requireStatus(league: League, ...status: League['status'][]): void {
  if (!status.includes(league.status)) throw new DomainError('INVALID_STATE');
}

/**
 * League commands — pure state transitions of the league aggregate (lobby,
 * configuration, phases). They validate first and mutate after, and return the
 * domain events they produced.
 */
export const LeagueCommands = {
  create(args: { id: string; code: string; config: LeagueConfigInput; master: Participant; now: number; rng: Rng }): { league: League; events: DomainEvent[] } {
    const config = resolveConfig(args.config);
    const team = makeTeam(args.master, 0, args.rng, config.startingCredits);
    const league: League = {
      id: args.id,
      code: args.code,
      config,
      status: 'lobby',
      season: 1,
      createdAt: args.now,
      members: [member(args.master, team.id, true, null, args.now)],
      teams: [team],
      customItems: [],
      pool: [],
      auction: createAuctionState(),
      tournament: null,
      standings: [],
      feed: [],
      awards: [],
      history: [],
      version: 1,
    };
    league.members[0].connected = true;
    const events = [postFeed(league, 'league_created', '🏟️', `${league.members[0].displayName} ha fondato la lega "${config.name}"`, args.now)];
    return { league, events };
  },

  join(league: League, p: Participant, now: number, rng: Rng): DomainEvent[] {
    if (league.members.some((m) => m.userId === p.userId)) throw new DomainError('ALREADY_MEMBER');
    requireStatus(league, 'lobby');
    if (league.members.length >= league.config.maxParticipants) throw new DomainError('LEAGUE_FULL');
    const team = makeTeam(p, league.teams.length, rng, league.config.startingCredits);
    // presence becomes true when the member's realtime connection subscribes to the league
    const m = member(p, team.id, false, null, now);
    league.teams.push(team);
    league.members.push(m);
    return [
      { type: 'MemberJoined', userId: m.userId, teamId: team.id, displayName: m.displayName },
      postFeed(league, 'member_joined', '👋', `${m.displayName} è entrato con ${team.name}`, now),
    ];
  },

  addBots(league: League, byUserId: string, archetypes: BotArchetype[], now: number, rng: Rng): DomainEvent[] {
    requireMaster(league, byUserId);
    requireStatus(league, 'lobby');
    const free = league.config.maxParticipants - league.members.length;
    if (archetypes.length > free) throw new DomainError('LEAGUE_FULL');
    const events: DomainEvent[] = [];
    for (const archetype of archetypes) {
      const used = new Set(league.members.map((m) => m.displayName));
      const name = BOT_NAMES[archetype].find((n) => !used.has(n)) ?? `${BOT_PROFILES[archetype].label} ${league.members.length}`;
      const userId = `bot-${archetype}-${league.id}-${league.members.length}-${rng.int(1000, 9999)}`;
      const p: Participant = { userId, displayName: name, avatar: BOT_PROFILES[archetype].emoji, teamName: `${name} FC` };
      const team = makeTeam(p, league.teams.length, rng, league.config.startingCredits);
      league.teams.push(team);
      league.members.push(member(p, team.id, false, archetype, now));
      events.push({ type: 'MemberJoined', userId, teamId: team.id, displayName: name });
    }
    return events;
  },

  /** Leaving is only possible in the lobby; afterwards the team stays (a friend can reconnect). */
  leave(league: League, userId: string, byUserId: string): DomainEvent[] {
    requireStatus(league, 'lobby');
    const target = league.members.find((m) => m.userId === userId);
    if (!target) throw new DomainError('NOT_FOUND');
    if (userId !== byUserId) requireMaster(league, byUserId);
    league.members = league.members.filter((m) => m.userId !== userId);
    league.teams = league.teams.filter((t) => t.id !== target.teamId);
    if (target.isMaster) {
      const heir = league.members.filter((m) => !m.bot).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (heir) heir.isMaster = true;
    }
    return [{ type: 'MemberLeft', userId }];
  },

  setReady(league: League, userId: string, ready: boolean): DomainEvent[] {
    requireStatus(league, 'lobby');
    const m = league.members.find((x) => x.userId === userId);
    if (!m) throw new DomainError('NOT_FOUND');
    m.ready = ready;
    return [{ type: 'MemberReady', userId, ready }];
  },

  updateTeam(league: League, userId: string, patch: { name?: string; logo?: TeamLogo }): DomainEvent[] {
    requireStatus(league, 'lobby', 'pre_season');
    const team = league.teams.find((t) => t.ownerId === userId);
    if (!team) throw new DomainError('NOT_FOUND');
    if (patch.name !== undefined) {
      const name = patch.name.trim().slice(0, 28);
      if (name.length < 2) throw new DomainError('INVALID_INPUT');
      team.name = name;
    }
    if (patch.logo) team.logo = { emoji: patch.logo.emoji.slice(0, 4), color: /^#[0-9a-fA-F]{6}$/.test(patch.logo.color) ? patch.logo.color : team.logo.color };
    return [];
  },

  updateConfig(league: League, userId: string, input: LeagueConfigInput): DomainEvent[] {
    requireMaster(league, userId);
    requireStatus(league, 'lobby');
    const config: LeagueConfig = resolveConfig(input, league.config);
    if (config.maxParticipants < league.members.length) throw new DomainError('INVALID_CONFIG', 'Ci sono già più partecipanti');
    const creditsChanged = config.startingCredits !== league.config.startingCredits;
    league.config = config;
    if (creditsChanged) for (const t of league.teams) t.credits = config.startingCredits;
    // configuration changes invalidate readiness: everyone must confirm the new rules
    for (const m of league.members) if (!m.bot && !m.isMaster) m.ready = false;
    return [{ type: 'ConfigUpdated' }];
  },

  addCustomItems(league: League, userId: string, items: CatalogItem[]): DomainEvent[] {
    requireMaster(league, userId);
    requireStatus(league, 'lobby');
    const ids = new Set(league.customItems.map((i) => i.id));
    for (const item of items) if (!ids.has(item.id)) league.customItems.push(item);
    if (league.customItems.length > 400) throw new DomainError('INVALID_INPUT', 'Troppi giocatori custom');
    return [{ type: 'ConfigUpdated' }];
  },

  removeCustomItem(league: League, userId: string, itemId: string): DomainEvent[] {
    requireMaster(league, userId);
    requireStatus(league, 'lobby');
    league.customItems = league.customItems.filter((i) => i.id !== itemId);
    return [{ type: 'ConfigUpdated' }];
  },

  /** Requirements for the Master's "INIZIA ASTA" button. */
  canStartAuction(league: League): { ok: boolean; reason?: string } {
    if (league.status !== 'lobby') return { ok: false, reason: 'INVALID_STATE' };
    if (league.members.length < 2) return { ok: false, reason: 'NOT_ENOUGH_PARTICIPANTS' };
    if (league.members.some((m) => !m.isMaster && !m.ready)) return { ok: false, reason: 'NOT_ALL_READY' };
    return { ok: true };
  },

  startAuction(league: League, userId: string, now: number, rng: Rng): DomainEvent[] {
    requireMaster(league, userId);
    const check = LeagueCommands.canStartAuction(league);
    if (!check.ok) throw new DomainError(check.reason as 'NOT_ALL_READY');
    league.pool = buildPool(league.config, league.customItems, league.teams.length, rng);
    league.status = 'auction';
    league.auction = createAuctionState();
    const events = [postFeed(league, 'auction_started', '🔨', `È iniziata l'asta! ${league.pool.length} elementi nel pool`, now)];
    return events.concat(AuctionEngine.start(league, rng, now));
  },

  startSeason(league: League, userId: string, now: number, rng: Rng): DomainEvent[] {
    requireMaster(league, userId);
    requireStatus(league, 'pre_season');
    league.tournament = TournamentEngine.create(league, rng);
    league.standings = computeStandings(league.teams.map((t) => t.id), [], league.tournament.groups);
    league.status = 'season';
    return [
      { type: 'SeasonStarted', season: league.season, rounds: league.tournament.totalRounds },
      postFeed(league, 'season_started', '📅', `Calendario pronto: stagione ${league.season}, ${league.tournament.matches.length} partite in programma`, now),
    ];
  },

  /** Snapshot of the finished season for the Albo d'oro. */
  archiveSeason(league: League, now: number, records: SeasonArchive['records']): SeasonArchive {
    const champ = league.tournament?.championTeamId ?? null;
    const archive: SeasonArchive = {
      season: league.season,
      championTeamId: champ,
      championName: league.teams.find((t) => t.id === champ)?.name ?? '—',
      finishedAt: now,
      standings: league.standings,
      awards: league.awards,
      teams: league.teams.map((t) => ({
        id: t.id,
        name: t.name,
        ownerName: league.members.find((m) => m.userId === t.ownerId)?.displayName ?? '—',
        logo: t.logo,
        roster: t.roster,
        creditsLeft: t.credits,
      })),
      auction: league.auction.results,
      matches: league.tournament?.matches ?? [],
      records,
    };
    league.history.push(archive);
    return archive;
  },

  /** Back to the lobby for a new season: history is kept, rosters and credits reset. */
  newSeason(league: League, userId: string): DomainEvent[] {
    requireMaster(league, userId);
    requireStatus(league, 'completed');
    league.season += 1;
    league.status = 'lobby';
    league.pool = [];
    league.auction = createAuctionState();
    league.tournament = null;
    league.standings = [];
    league.awards = [];
    for (const t of league.teams) {
      t.credits = league.config.startingCredits;
      t.roster = [];
    }
    for (const m of league.members) m.ready = m.bot !== null;
    return [{ type: 'ConfigUpdated' }];
  },
};
