import type { FeedItem, LotResult, MatchEvent, Slot } from '../domain/types';

/**
 * Domain events emitted by the engines. They are the single source that feeds
 * the UI (animations), statistics, commentary, notifications, persistence and history.
 */
export type DomainEvent =
  | { type: 'MemberJoined'; userId: string; teamId: string; displayName: string }
  | { type: 'MemberLeft'; userId: string }
  | { type: 'MemberReady'; userId: string; ready: boolean }
  | { type: 'ConfigUpdated' }
  | { type: 'AuctionStarted'; poolSize: number }
  | { type: 'LotOpened'; lotId: string; number: number; itemId: string; slot: Slot; endsAt: number }
  | { type: 'BidPlaced'; lotId: string; itemId: string; teamId: string; amount: number; previousAmount: number; endsAt: number }
  | { type: 'AuctionExtended'; lotId: string; endsAt: number }
  | { type: 'Outbid'; lotId: string; itemId: string; teamId: string; byTeamId: string; amount: number }
  | { type: 'PlayerSold'; result: LotResult }
  | { type: 'LotUnsold'; lotId: string; itemId: string }
  | { type: 'TeamCompleted'; teamId: string }
  | { type: 'AuctionPaused' }
  | { type: 'AuctionResumed'; endsAt: number | null }
  | { type: 'AuctionCompleted' }
  | { type: 'SeasonStarted'; season: number; rounds: number }
  | { type: 'MatchStarted'; matchId: string; homeTeamId: string; awayTeamId: string; kickoffAt: number }
  | { type: 'MatchEvent'; matchId: string; event: MatchEvent }
  | { type: 'MatchEnded'; matchId: string; homeTeamId: string; awayTeamId: string; homeGoals: number; awayGoals: number }
  | { type: 'RoundCompleted'; round: number }
  | { type: 'TournamentCompleted'; championTeamId: string | null }
  | { type: 'FeedPosted'; item: FeedItem };

export type DomainEventType = DomainEvent['type'];
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
