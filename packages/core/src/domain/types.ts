/**
 * Asta Legends — core domain model.
 *
 * Every type in this file is plain serialisable data (no classes, no functions):
 * the same objects travel through the engines, the server, SQLite and the socket.
 */

// ───────────────────────────── Football catalog ─────────────────────────────

export type Position = 'GK' | 'DF' | 'MF' | 'FW';
export const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW'];

export type Foot = 'L' | 'R' | 'B';
export type Era = '70s' | '80s' | '90s' | '2000s' | '2010s' | '2020s';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type PlayStyle =
  // goalkeepers
  | 'shot_stopper'
  | 'sweeper_keeper'
  // defenders
  | 'stopper'
  | 'ball_playing_defender'
  | 'libero'
  | 'wingback'
  // midfielders
  | 'regista'
  | 'box_to_box'
  | 'ball_winner'
  | 'playmaker'
  | 'trequartista'
  | 'winger'
  // forwards
  | 'poacher'
  | 'target_man'
  | 'complete_forward'
  | 'false_nine'
  | 'inside_forward'
  | 'speedster';

/** Detailed individual attributes (1–99). Goalkeeping attributes are low for outfield players. */
export interface PlayerStats {
  pace: number;
  acceleration: number;
  shooting: number;
  passing: number;
  dribbling: number;
  ballControl: number;
  physical: number;
  stamina: number;
  strength: number;
  defending: number;
  marking: number;
  tackling: number;
  positioning: number;
  vision: number;
  composure: number;
  finishing: number;
  heading: number;
  longShots: number;
  crossing: number;
  freeKick: number;
  penalty: number;
  aggression: number;
  // goalkeeping
  diving: number;
  handling: number;
  reflexes: number;
  kicking: number;
}

export type StatKey = keyof PlayerStats;

export interface Player {
  id: string;
  kind: 'player';
  name: string;
  nationality: string;
  position: Position;
  /** e.g. "2011-2012": the player is always used in his PRIME version */
  primePeriod: string;
  overall: number;
  stats: PlayerStats;
  playStyle: PlayStyle;
  foot: Foot;
  heightCm: number;
  /** 1–5 */
  weakFoot: number;
  /** 1–5 */
  skillMoves: number;
  rarity: Rarity;
  baseAuctionValue: number;
  tags: string[];
  historicalClub: string;
  era: Era;
  /** 'catalog' = seed database, 'custom' = added by the Master, 'ai' = generated */
  source: 'catalog' | 'custom' | 'ai';
}

export type Tactic =
  | 'possession'
  | 'gegenpress'
  | 'counter'
  | 'catenaccio'
  | 'balanced'
  | 'direct'
  | 'total_football';

/** Signed bonuses, roughly in the range −10…+10. They feed the match engine directly. */
export interface CoachModifiers {
  possession: number;
  passing: number;
  pressing: number;
  defense: number;
  counter: number;
  attack: number;
  /** how well the team protects a lead */
  leadManagement: number;
  /** how well the team reacts when behind */
  deficitManagement: number;
  /** reduces the malus when the squad does not fit the preferred tactic */
  adaptability: number;
  /** morale swing after goals, big moments */
  motivation: number;
}

export interface Coach {
  id: string;
  kind: 'coach';
  name: string;
  nationality: string;
  primePeriod: string;
  overall: number;
  style: string;
  preferredTactic: Tactic;
  modifiers: CoachModifiers;
  rarity: Rarity;
  baseAuctionValue: number;
  tags: string[];
  era: Era;
  source: 'catalog' | 'custom' | 'ai';
}

export type CatalogItem = Player | Coach;
export type ItemKind = 'player' | 'coach';
/** Slot type: the 4 outfield/goal roles plus the coach */
export type Slot = Position | 'COACH';

// ───────────────────────────── League configuration ─────────────────────────

export type CompetitionFormat = 'round_robin' | 'double_round_robin' | 'groups_knockout' | 'knockout';
export type CommentaryTone = 'classico' | 'epico' | 'tecnico' | 'ironico' | 'trash' | 'bar_sport';
export type PoolPreset = 'LEGENDS' | 'MODERN' | 'MIXED' | 'RANDOM' | 'CUSTOM';
/** What happens to a lot nobody bid on: 'discard' = out of the auction, 'requeue' = called again at the end */
export type UnsoldPolicy = 'discard' | 'requeue';

export interface RosterRequirements {
  GK: number;
  DF: number;
  MF: number;
  FW: number;
  coach: boolean;
}

export interface LeagueConfig {
  name: string;
  maxParticipants: number;
  startingCredits: number;
  format: CompetitionFormat;
  roster: RosterRequirements;
  /** seconds a lot stays open after the last bid */
  bidTimerSeconds: number;
  /** seconds a lot stays open when nobody has bid yet */
  openingTimerSeconds: number;
  minIncrement: number;
  /** price of the first bid and minimum price reserved for every empty slot */
  minPrice: number;
  /** fate of unsold lots (older leagues may miss it: treated as 'discard') */
  unsoldPolicy: UnsoldPolicy;
  homeAway: boolean;
  playoffs: boolean;
  /** 2 = final only, 4 = semifinals + final */
  playoffTeams: 2 | 4;
  poolPreset: PoolPreset;
  /** optional thematic sets (tags) used to filter the pool */
  poolSets: string[];
  /** extra items drawn on top of the strict need (0 = exactly what is needed) */
  poolExtraRatio: number;
  commentaryTone: CommentaryTone;
  /** real seconds a live match lasts for everyone (shared live) */
  liveMatchSeconds: number;
  visibility: {
    othersCredits: boolean;
    othersRosters: boolean;
    bidderNames: boolean;
  };
  /** free-text custom rules shown in the lobby */
  customRules: string;
}

// ───────────────────────────── League aggregate ─────────────────────────────

export interface TeamLogo {
  emoji: string;
  color: string;
}

export interface RosterEntry {
  itemId: string;
  kind: ItemKind;
  slot: Slot;
  price: number;
  lotNumber: number;
  /** true when assigned automatically at the end of the pool */
  autoAssigned: boolean;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  logo: TeamLogo;
  credits: number;
  roster: RosterEntry[];
}

export const BOT_ARCHETYPES = ['saver', 'shark', 'fan', 'tactician', 'sniper', 'gambler', 'moneyball', 'provocateur', 'kamikaze'] as const;
export type BotArchetype = (typeof BOT_ARCHETYPES)[number];

export interface Member {
  userId: string;
  displayName: string;
  avatar: string;
  teamId: string;
  isMaster: boolean;
  ready: boolean;
  connected: boolean;
  bot: BotArchetype | null;
  joinedAt: number;
}

// ── Auction

export interface Bid {
  id: string;
  lotId: string;
  teamId: string;
  amount: number;
  at: number;
}

export interface Lot {
  id: string;
  number: number;
  itemId: string;
  kind: ItemKind;
  slot: Slot;
  openedAt: number;
  endsAt: number;
  currentBid: number;
  leaderTeamId: string | null;
  bids: Bid[];
}

export interface LotResult {
  lotId: string;
  number: number;
  itemId: string;
  kind: ItemKind;
  slot: Slot;
  teamId: string | null;
  price: number;
  bidCount: number;
  closedAt: number;
  autoAssigned: boolean;
}

export type AuctionStatus = 'not_started' | 'lot_open' | 'lot_sold' | 'paused' | 'completed';

export interface AuctionState {
  status: AuctionStatus;
  /** server-only: never sent to clients (projection strips it) */
  queue: string[];
  /** items that nobody wanted, retried once the queue is empty */
  unsold: string[];
  lotCounter: number;
  currentLot: Lot | null;
  /** the lot that has just been closed, shown in the SOLD! overlay */
  lastResult: LotResult | null;
  /** timestamp when the next lot opens (during lot_sold) */
  nextLotAt: number | null;
  results: LotResult[];
  /** remaining ms of the lot when paused */
  pausedRemainingMs: number | null;
  /** idempotency: bid ids already processed */
  processedBidIds: string[];
}

// ── Tournament

export type MatchStage = 'league' | 'group' | 'round16' | 'quarterfinal' | 'semifinal' | 'final';
export type MatchStatus = 'scheduled' | 'live' | 'finished';

// ── Team talk ("discorso allo spogliatoio")

export type TalkPhrase = 'prove_them_wrong' | 'we_are_better' | 'enjoy_it' | 'match_of_season' | 'disappointed' | 'for_the_fans';
export type TalkTone = 'calm' | 'passionate' | 'aggressive' | 'confident';
export type TalkReaction = 'fired_up' | 'focused' | 'neutral' | 'complacent' | 'nervous';

/** Effects of a team talk on a match, fed to the match engine. */
export interface TalkEffect {
  /** added to the team's in-match morale at kickoff (fades during the match) */
  morale: number;
  /** multiplier on the chance of cards for the team's fouls (1 = neutral) */
  discipline: number;
  /** multiplier on the chance of the team's defensive errors (1 = neutral) */
  focus: number;
}

export interface TeamTalk extends TalkEffect {
  teamId: string;
  phrase: TalkPhrase;
  tone: TalkTone;
  reaction: TalkReaction;
  at: number;
}

export interface MatchSummary {
  id: string;
  round: number;
  stage: MatchStage;
  group: string | null;
  homeTeamId: string;
  awayTeamId: string;
  status: MatchStatus;
  seed: number;
  /** when the (shared) live playback started, server clock */
  kickoffAt: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  /** penalty shoot-out result in knockout ties */
  homePens: number | null;
  awayPens: number | null;
  mvpPlayerId: string | null;
  /** pre-match team talks of important matches (at most one per team) */
  talks?: TeamTalk[];
}

export interface Tournament {
  format: CompetitionFormat;
  currentRound: number;
  totalRounds: number;
  phase: 'regular' | 'playoffs' | 'completed';
  groups: Record<string, string[]> | null;
  /** ordered knockout slots of the current stage (adjacent pairs play each other); null = bye */
  bracket: (string | null)[] | null;
  matches: MatchSummary[];
  championTeamId: string | null;
}

export interface StandingRow {
  teamId: string;
  group: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

// ── Match detail

export type MatchEventType =
  | 'kickoff'
  | 'pass'
  | 'dribble'
  | 'tackle'
  | 'interception'
  | 'chance'
  | 'big_chance'
  | 'counter'
  | 'shot'
  | 'save'
  | 'post'
  | 'crossbar'
  | 'miss'
  | 'blocked'
  | 'corner'
  | 'foul'
  | 'yellow'
  | 'red'
  | 'penalty_awarded'
  | 'penalty_scored'
  | 'penalty_missed'
  | 'goal'
  | 'own_goal'
  | 'defensive_error'
  | 'injury'
  | 'halftime'
  | 'fulltime'
  | 'shootout_start'
  | 'shootout_kick';

export interface MatchEvent {
  seq: number;
  minute: number;
  /** stoppage time minute (45+2 → minute 45, extra 2) */
  extra?: number;
  /** monotonic timeline position (match minutes incl. stoppage & break), drives live playback */
  t: number;
  type: MatchEventType;
  teamId: string | null;
  playerId: string | null;
  /** assist man, goalkeeper, tackler, fouled player… depending on event */
  secondaryPlayerId: string | null;
  /** 1 = colour, 2 = notable, 3 = key moment */
  importance: 1 | 2 | 3;
  homeGoals: number;
  awayGoals: number;
  xg?: number;
  /** extra structured info (shot kind, scored in shoot-out, …) */
  detail?: string;
  commentary: string;
}

export interface TeamMatchStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  passes: number;
  dribbles: number;
  tackles: number;
  saves: number;
  bigChances: number;
}

export interface PlayerMatchStats {
  playerId: string;
  teamId: string;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  keyPasses: number;
  dribbles: number;
  tackles: number;
  saves: number;
  goalsConceded: number;
  yellow: number;
  red: number;
  xg: number;
  cleanSheet: boolean;
}

export interface LineupSlotView {
  playerId: string;
  name: string;
  position: Position;
  overall: number;
}

export interface MatchLineup {
  teamId: string;
  coachId: string | null;
  tactic: Tactic;
  formation: string;
  players: LineupSlotView[];
  strength: TeamStrengthView;
}

export interface TeamStrengthView {
  overall: number;
  attack: number;
  midfield: number;
  defense: number;
  goalkeeper: number;
}

export interface MatchResult {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  homePens: number | null;
  awayPens: number | null;
  events: MatchEvent[];
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  playerStats: PlayerMatchStats[];
  mvpPlayerId: string | null;
  lineups: { home: MatchLineup; away: MatchLineup };
  /** timeline length in the same unit as MatchEvent.t */
  totalTime: number;
  /** most spectacular goal & save of the match, used for tournament awards */
  highlights: {
    bestGoal: { seq: number; playerId: string; teamId: string; score: number } | null;
    bestSave: { seq: number; playerId: string; teamId: string; score: number } | null;
  };
}

// ── Social

export type FeedKind =
  | 'league_created'
  | 'member_joined'
  | 'auction_started'
  | 'purchase'
  | 'overpay'
  | 'bargain'
  | 'auction_completed'
  | 'match_result'
  | 'leader'
  | 'champion'
  | 'season_started'
  | 'ai_players'
  | 'chat';

export interface FeedComment {
  id: string;
  userId: string;
  text: string;
  at: number;
}

export interface FeedItem {
  id: string;
  kind: FeedKind;
  emoji: string;
  text: string;
  at: number;
  reactions: Record<string, string[]>;
  comments: FeedComment[];
}

// ── Awards & history

export type AwardKey =
  | 'champion'
  | 'top_scorer'
  | 'top_assist'
  | 'best_goalkeeper'
  | 'mvp'
  | 'best_coach'
  | 'goal_of_tournament'
  | 'save_of_tournament'
  | 'best_buy'
  | 'worst_buy'
  | 'bargain'
  | 'most_expensive';

export interface Award {
  key: AwardKey;
  title: string;
  teamId: string | null;
  itemId: string | null;
  value: string;
  description: string;
}

export interface SeasonArchive {
  season: number;
  championTeamId: string | null;
  championName: string;
  finishedAt: number;
  standings: StandingRow[];
  awards: Award[];
  teams: { id: string; name: string; ownerName: string; logo: TeamLogo; roster: RosterEntry[]; creditsLeft: number }[];
  auction: LotResult[];
  matches: MatchSummary[];
  records: { label: string; value: string }[];
}

export type LeagueStatus = 'lobby' | 'auction' | 'pre_season' | 'season' | 'completed';

export interface League {
  id: string;
  code: string;
  config: LeagueConfig;
  status: LeagueStatus;
  season: number;
  createdAt: number;
  members: Member[];
  teams: Team[];
  /** custom and AI generated items that belong only to this league */
  customItems: CatalogItem[];
  /** ids of every item available in this season's auction */
  pool: string[];
  auction: AuctionState;
  tournament: Tournament | null;
  standings: StandingRow[];
  feed: FeedItem[];
  awards: Award[];
  history: SeasonArchive[];
  /** monotonic version, bumped on every accepted command (reconnect / patch ordering) */
  version: number;
}
