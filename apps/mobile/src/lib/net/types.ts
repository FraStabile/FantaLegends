import type {
  BotArchetype,
  CatalogItem,
  CustomPlayerInput,
  DomainEvent,
  GenerationRequest,
  LeagueConfigInput,
  LeagueView,
  MatchView,
  SeasonStatistics,
  TalkPhrase,
  TalkTone,
  TeamLogo,
} from '@asta/core';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface AppNotification {
  kind: string;
  title: string;
  body: string;
  leagueId: string;
}

export interface LeagueSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  season: number;
  members: number;
  updatedAt: number;
}

export interface GenerationPreview {
  generationId: string;
  source: 'claude' | 'offline';
  note: string | null;
  rejected: number;
  request: GenerationRequest;
  items: CatalogItem[];
}

export interface InvitePreview {
  id: string;
  name: string;
  code: string;
  status: string;
  members: { displayName: string; avatar: string; isMaster: boolean }[];
  maxParticipants: number;
}

/** Every realtime command understood by the authoritative host. */
export interface CommandMap {
  'lobby:ready': { ready: boolean };
  'lobby:config': { config: LeagueConfigInput };
  'lobby:team': { name?: string; logo?: TeamLogo };
  'lobby:addBots': { archetypes: BotArchetype[] };
  'lobby:kick': { userId: string };
  'lobby:leave': Record<string, never>;
  'auction:start': Record<string, never>;
  'auction:bid': { lotId: string; amount: number; bidId: string };
  'auction:pause': Record<string, never>;
  'auction:resume': Record<string, never>;
  'season:start': Record<string, never>;
  'round:play': { mode: 'live' | 'instant' };
  'match:talk': { matchId: string; phrase: TalkPhrase; tone: TalkTone };
  'season:new': Record<string, never>;
  'feed:react': { feedId: string; emoji: string };
  'feed:comment': { feedId: string; text: string };
  'feed:chat': { text: string };
}
export type CommandName = keyof CommandMap;

export interface LeagueSubscription {
  onState(view: LeagueView): void;
  onEvents?(events: DomainEvent[]): void;
}

/**
 * Transport-agnostic game API used by the whole UI.
 * `RemoteClient` talks to the authoritative server; `LocalClient` runs the very
 * same authoritative LeagueHost in-process for the offline Demo Mode.
 */
export interface GameClient {
  readonly mode: 'remote' | 'local';
  readonly userId: string;
  /** server clock estimate (ms) — timers are always computed against it */
  serverNow(): number;
  onConnection(listener: (s: ConnectionStatus) => void): () => void;
  onNotification(listener: (n: AppNotification) => void): () => void;
  listLeagues(): Promise<LeagueSummary[]>;
  createLeague(input: { config: LeagueConfigInput; teamName?: string; logo?: TeamLogo }): Promise<LeagueView>;
  invitePreview(code: string): Promise<InvitePreview>;
  joinLeague(code: string, teamName?: string): Promise<LeagueView>;
  subscribe(leagueId: string, sub: LeagueSubscription): () => void;
  command<K extends CommandName>(leagueId: string, name: K, payload: CommandMap[K]): Promise<unknown>;
  getMatch(leagueId: string, matchId: string): Promise<MatchView>;
  getStats(leagueId: string): Promise<SeasonStatistics>;
  generatePlayers(leagueId: string, prompt: string): Promise<GenerationPreview>;
  confirmGeneration(leagueId: string, generationId: string, itemIds?: string[]): Promise<number>;
  addCustomPlayer(leagueId: string, input: CustomPlayerInput): Promise<CatalogItem>;
  removeCustomItem(leagueId: string, itemId: string): Promise<void>;
  dispose(): void;
}

export class ClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
