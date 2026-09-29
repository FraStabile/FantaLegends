// Domain
export * from './domain/types';
export * from './domain/errors';
export * from './domain/config';

// Catalog & seed data
export * from './catalog/catalog';
export * from './catalog/expand';
export * from './catalog/customPlayer';
export type { SeedPlayer, SeedCoach } from './catalog/seedTypes';

// Ratings, team, economy
export * from './rating/playerRating';
export * from './team/teamValidation';
export * from './economy/budget';

// Auction
export * from './auction/auctionEngine';
export * from './auction/bidValidation';

// Bots
export * from './bots/botBrain';

// Match
export * from './match/matchEngine';
export * from './match/tactics';
export * from './match/coachModifiers';
export * from './match/teamStrength';
export * from './match/ratings';
export * from './match/teamTalk';

// Commentary
export * from './commentary/narrator';
export * from './commentary/templateTypes';

// Tournament, stats, awards
export * from './tournament/schedule';
export * from './tournament/standings';
export * from './tournament/tournamentEngine';
export * from './stats/statistics';
export * from './stats/awards';

// Social
export * from './social/feed';

// League runtime
export * from './league/commands';
export * from './league/projection';
export * from './league/scheduler';
export * from './league/leagueHost';

// Events
export * from './events/types';
export * from './events/eventBus';

// AI
export * from './ai/playerSchema';
export * from './ai/generationRequest';

// Utils
export * from './util/rng';
