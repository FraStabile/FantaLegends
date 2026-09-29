import type {
  AuctionState,
  CatalogItem,
  FeedItem,
  League,
  LeagueConfig,
  LotResult,
  MatchEvent,
  MatchResult,
  Member,
  PlayerMatchStats,
  SeasonArchive,
  StandingRow,
  Team,
  Tournament,
  Award,
} from '@asta/core';
import { transaction, type Db } from './database.js';

type Row = Record<string, unknown>;
const bool = (v: unknown) => v === 1 || v === true;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * Maps the League aggregate to the normalised tables and back.
 *
 * Small, frequently changing tables (members, teams, rosters, standings, feed)
 * are rewritten inside one transaction; append-only history (lots, bids,
 * matches, events, statistics, seasons) is written with INSERT OR IGNORE so
 * saving after every command stays cheap and idempotent.
 */
export class LeagueRepository {
  constructor(private readonly db: Db) {}

  codeExists(code: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM leagues WHERE code = ?').get(code);
  }

  idByCode(code: string): string | null {
    const row = this.db.prepare('SELECT id FROM leagues WHERE code = ?').get(code.toUpperCase()) as Row | undefined;
    return (row?.id as string) ?? null;
  }

  leagueIdsOfUser(userId: string): string[] {
    return (this.db.prepare('SELECT league_id FROM league_members WHERE user_id = ? ORDER BY joined_at DESC').all(userId) as Row[]).map((r) => r.league_id as string);
  }

  summaries(userId: string): { id: string; name: string; code: string; status: string; season: number; members: number; updatedAt: number }[] {
    return (this.db
      .prepare(`SELECT l.id, l.name, l.code, l.status, l.season, l.updated_at,
                  (SELECT COUNT(*) FROM league_members m2 WHERE m2.league_id = l.id) AS members
                FROM leagues l JOIN league_members m ON m.league_id = l.id
                WHERE m.user_id = ? ORDER BY l.updated_at DESC`)
      .all(userId) as Row[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      code: r.code as string,
      status: r.status as string,
      season: Number(r.season),
      members: Number(r.members),
      updatedAt: Number(r.updated_at),
    }));
  }

  save(league: League): void {
    const db = this.db;
    const L = league.id;
    const S = league.season;
    transaction(db, () => {
      db.prepare(`
        INSERT INTO leagues (id, code, name, status, season, config_json, pool_json, tournament_json, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, season = excluded.season,
          config_json = excluded.config_json, pool_json = excluded.pool_json, tournament_json = excluded.tournament_json,
          version = excluded.version, updated_at = excluded.updated_at`).run(
        L, league.code, league.config.name, league.status, S, JSON.stringify(league.config), JSON.stringify(league.pool),
        league.tournament ? JSON.stringify({ ...league.tournament, matches: undefined }) : null, league.version, league.createdAt, Date.now(),
      );

      // teams & members (members reference teams)
      // teams are upserted (not deleted) so rosters of past seasons survive in team_players
      db.prepare('DELETE FROM league_members WHERE league_id = ?').run(L);
      db.prepare('DELETE FROM team_players WHERE league_id = ? AND season = ?').run(L, S);
      const keep = league.teams.map((t) => t.id);
      db.prepare(`DELETE FROM teams WHERE league_id = ? AND id NOT IN (${keep.map(() => '?').join(',') || "''"})`).run(L, ...keep);
      const insTeam = db.prepare(`INSERT INTO teams (id, league_id, owner_id, name, logo_emoji, logo_color, credits, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(league_id, id) DO UPDATE SET name = excluded.name, logo_emoji = excluded.logo_emoji, logo_color = excluded.logo_color,
          credits = excluded.credits, position = excluded.position`);
      const insRoster = db.prepare('INSERT INTO team_players (league_id, season, team_id, item_id, kind, slot, price, lot_number, auto_assigned, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      league.teams.forEach((t, i) => {
        insTeam.run(t.id, L, t.ownerId, t.name, t.logo.emoji, t.logo.color, t.credits, i);
        t.roster.forEach((r, j) => insRoster.run(L, S, t.id, r.itemId, r.kind, r.slot, r.price, r.lotNumber, r.autoAssigned ? 1 : 0, j));
      });
      const insMember = db.prepare('INSERT INTO league_members (league_id, user_id, team_id, display_name, avatar, is_master, ready, bot, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const m of league.members) insMember.run(L, m.userId, m.teamId, m.displayName, m.avatar, m.isMaster ? 1 : 0, m.ready ? 1 : 0, m.bot, m.joinedAt);

      // custom / AI items of this league
      db.prepare('DELETE FROM players WHERE league_id = ?').run(L);
      db.prepare('DELETE FROM managers WHERE league_id = ?').run(L);
      const insP = db.prepare('INSERT INTO players (id, league_id, name, nationality, position, prime_period, overall, era, rarity, base_value, source, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const insC = db.prepare('INSERT INTO managers (id, league_id, name, overall, tactic, source, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const it of league.customItems) {
        if (it.kind === 'player') insP.run(it.id, L, it.name, it.nationality, it.position, it.primePeriod, it.overall, it.era, it.rarity, it.baseAuctionValue, it.source, JSON.stringify(it));
        else insC.run(it.id, L, it.name, it.overall, it.preferredTactic, it.source, JSON.stringify(it));
      }

      // auction runtime state + append-only ledger
      const { results, ...runtime } = league.auction;
      db.prepare(`INSERT INTO auctions (league_id, season, status, lot_counter, state_json) VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(league_id, season) DO UPDATE SET status = excluded.status, lot_counter = excluded.lot_counter, state_json = excluded.state_json`)
        .run(L, S, league.auction.status, league.auction.lotCounter, JSON.stringify(runtime));
      const insLot = db.prepare(`INSERT OR IGNORE INTO auction_lots (id, league_id, season, number, item_id, kind, slot, team_id, price, bid_count, auto_assigned, closed_at, seq)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      // unsold lots can be re-auctioned with the same number: the ledger key includes the position
      results.forEach((r, i) => insLot.run(`${r.lotId}#${i}`, L, S, r.number, r.itemId, r.kind, r.slot, r.teamId, r.price, r.bidCount, r.autoAssigned ? 1 : 0, r.closedAt, i));
      const insBid = db.prepare('INSERT OR IGNORE INTO auction_bids (id, league_id, lot_id, team_id, amount, at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const b of league.auction.currentLot?.bids ?? []) insBid.run(`${L}:${b.id}`, L, b.lotId, b.teamId, b.amount, b.at);

      // matches (summary is mutable: status/score), standings, awards
      const upMatch = db.prepare(`
        INSERT INTO matches (id, league_id, season, round, stage, grp, home_team_id, away_team_id, status, seed, kickoff_at, home_goals, away_goals, home_pens, away_pens, mvp_player_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status, kickoff_at = excluded.kickoff_at, home_goals = excluded.home_goals,
          away_goals = excluded.away_goals, home_pens = excluded.home_pens, away_pens = excluded.away_pens, mvp_player_id = excluded.mvp_player_id`);
      for (const m of league.tournament?.matches ?? []) {
        upMatch.run(m.id, L, S, m.round, m.stage, m.group, m.homeTeamId, m.awayTeamId, m.status, m.seed, m.kickoffAt, m.homeGoals, m.awayGoals, m.homePens, m.awayPens, m.mvpPlayerId);
      }
      db.prepare('DELETE FROM standings WHERE league_id = ? AND season = ?').run(L, S);
      const insSt = db.prepare('INSERT INTO standings (league_id, season, team_id, grp, position, played, won, drawn, lost, goals_for, goals_against, points, form) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      league.standings.forEach((r, i) => insSt.run(L, S, r.teamId, r.group, i, r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst, r.points, r.form.join('')));
      db.prepare('DELETE FROM awards WHERE league_id = ? AND season = ?').run(L, S);
      const insAw = db.prepare('INSERT INTO awards (league_id, season, award_key, title, team_id, item_id, value, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const a of league.awards) insAw.run(L, S, a.key, a.title, a.teamId, a.itemId, a.value, a.description);

      // social feed (bounded) & history
      db.prepare('DELETE FROM feed_items WHERE league_id = ?').run(L);
      const insFeed = db.prepare('INSERT INTO feed_items (id, league_id, kind, emoji, text, at, reactions_json, comments_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const f of league.feed) insFeed.run(f.id, L, f.kind, f.emoji, f.text, f.at, JSON.stringify(f.reactions), JSON.stringify(f.comments));
      const insSeason = db.prepare('INSERT OR IGNORE INTO seasons (league_id, season, champion_team_id, champion_name, finished_at, archive_json) VALUES (?, ?, ?, ?, ?, ?)');
      for (const h of league.history) insSeason.run(L, h.season, h.championTeamId, h.championName, h.finishedAt, JSON.stringify(h));
    });
  }

  /** Match simulation output: written once per match. */
  saveResults(league: League, results: MatchResult[]): void {
    const db = this.db;
    transaction(db, () => {
      const upd = db.prepare('UPDATE matches SET result_json = ? WHERE id = ? AND league_id = ?');
      const insEv = db.prepare(`INSERT OR IGNORE INTO match_events (match_id, seq, t, minute, extra, type, team_id, player_id, secondary_player_id, importance, home_goals, away_goals, xg, detail, commentary)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const insSt = db.prepare(`INSERT OR IGNORE INTO statistics (match_id, league_id, season, player_id, team_id, rating, goals, assists, shots, shots_on_target, passes, key_passes, dribbles, tackles, saves, goals_conceded, yellow, red, xg, clean_sheet)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const r of results) {
        const { events, playerStats, ...rest } = r;
        upd.run(JSON.stringify(rest), r.matchId, league.id);
        for (const e of events) insEv.run(r.matchId, e.seq, e.t, e.minute, e.extra ?? null, e.type, e.teamId, e.playerId, e.secondaryPlayerId, e.importance, e.homeGoals, e.awayGoals, e.xg ?? null, e.detail ?? null, e.commentary);
        for (const p of playerStats) insSt.run(r.matchId, league.id, league.season, p.playerId, p.teamId, p.rating, p.goals, p.assists, p.shots, p.shotsOnTarget, p.passes, p.keyPasses, p.dribbles, p.tackles, p.saves, p.goalsConceded, p.yellow, p.red, p.xg, p.cleanSheet ? 1 : 0);
      }
    });
  }

  load(id: string): { league: League; results: MatchResult[] } | null {
    const db = this.db;
    const l = db.prepare('SELECT * FROM leagues WHERE id = ?').get(id) as Row | undefined;
    if (!l) return null;
    const season = Number(l.season);

    const teamRows = db.prepare('SELECT * FROM teams WHERE league_id = ? ORDER BY position').all(id) as Row[];
    const rosterRows = db.prepare('SELECT * FROM team_players WHERE league_id = ? AND season = ? ORDER BY seq').all(id, season) as Row[];
    const teams: Team[] = teamRows.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      ownerId: t.owner_id as string,
      logo: { emoji: t.logo_emoji as string, color: t.logo_color as string },
      credits: Number(t.credits),
      roster: rosterRows
        .filter((r) => r.team_id === t.id)
        .map((r) => ({ itemId: r.item_id as string, kind: r.kind as 'player' | 'coach', slot: r.slot as Team['roster'][number]['slot'], price: Number(r.price), lotNumber: Number(r.lot_number), autoAssigned: bool(r.auto_assigned) })),
    }));

    const members: Member[] = (db.prepare('SELECT * FROM league_members WHERE league_id = ? ORDER BY joined_at, rowid').all(id) as Row[]).map((m) => ({
      userId: m.user_id as string,
      displayName: m.display_name as string,
      avatar: m.avatar as string,
      teamId: m.team_id as string,
      isMaster: bool(m.is_master),
      ready: bool(m.ready),
      connected: m.bot !== null, // presence is runtime-only: humans reconnect
      bot: (m.bot as Member['bot']) ?? null,
      joinedAt: Number(m.joined_at),
    }));

    const customItems: CatalogItem[] = [
      ...(db.prepare('SELECT data_json FROM players WHERE league_id = ?').all(id) as Row[]),
      ...(db.prepare('SELECT data_json FROM managers WHERE league_id = ?').all(id) as Row[]),
    ].map((r) => JSON.parse(r.data_json as string));

    const auctionRow = db.prepare('SELECT state_json FROM auctions WHERE league_id = ? AND season = ?').get(id, season) as Row | undefined;
    const lotRows = db.prepare('SELECT * FROM auction_lots WHERE league_id = ? AND season = ? ORDER BY seq').all(id, season) as Row[];
    const results: LotResult[] = lotRows.map((r) => ({
      lotId: (r.id as string).split('#')[0],
      number: Number(r.number),
      itemId: r.item_id as string,
      kind: r.kind as LotResult['kind'],
      slot: r.slot as LotResult['slot'],
      teamId: (r.team_id as string) ?? null,
      price: Number(r.price),
      bidCount: Number(r.bid_count),
      closedAt: Number(r.closed_at),
      autoAssigned: bool(r.auto_assigned),
    }));
    const runtime = auctionRow ? (JSON.parse(auctionRow.state_json as string) as Omit<AuctionState, 'results'>) : null;
    const auction: AuctionState = runtime
      ? { ...runtime, results }
      : { status: 'not_started', queue: [], unsold: [], lotCounter: 0, currentLot: null, lastResult: null, nextLotAt: null, results: [], pausedRemainingMs: null, processedBidIds: [] };

    const matchRows = db.prepare('SELECT * FROM matches WHERE league_id = ? AND season = ? ORDER BY round, id').all(id, season) as Row[];
    const tournamentMeta = l.tournament_json ? (JSON.parse(l.tournament_json as string) as Omit<Tournament, 'matches'>) : null;
    const tournament: Tournament | null = tournamentMeta
      ? {
          ...tournamentMeta,
          matches: matchRows.map((m) => ({
            id: m.id as string,
            round: Number(m.round),
            stage: m.stage as Tournament['matches'][number]['stage'],
            group: (m.grp as string) ?? null,
            homeTeamId: m.home_team_id as string,
            awayTeamId: m.away_team_id as string,
            status: m.status as Tournament['matches'][number]['status'],
            seed: Number(m.seed),
            kickoffAt: num(m.kickoff_at),
            homeGoals: num(m.home_goals),
            awayGoals: num(m.away_goals),
            homePens: num(m.home_pens),
            awayPens: num(m.away_pens),
            mvpPlayerId: (m.mvp_player_id as string) ?? null,
          })),
        }
      : null;

    const standings: StandingRow[] = (db.prepare('SELECT * FROM standings WHERE league_id = ? AND season = ? ORDER BY position').all(id, season) as Row[]).map((r) => ({
      teamId: r.team_id as string,
      group: (r.grp as string) ?? null,
      played: Number(r.played),
      won: Number(r.won),
      drawn: Number(r.drawn),
      lost: Number(r.lost),
      goalsFor: Number(r.goals_for),
      goalsAgainst: Number(r.goals_against),
      goalDiff: Number(r.goals_for) - Number(r.goals_against),
      points: Number(r.points),
      form: (r.form as string).split('') as StandingRow['form'],
    }));
    const awards: Award[] = (db.prepare('SELECT * FROM awards WHERE league_id = ? AND season = ?').all(id, season) as Row[]).map((a) => ({
      key: a.award_key as Award['key'],
      title: a.title as string,
      teamId: (a.team_id as string) ?? null,
      itemId: (a.item_id as string) ?? null,
      value: a.value as string,
      description: a.description as string,
    }));
    const feed: FeedItem[] = (db.prepare('SELECT * FROM feed_items WHERE league_id = ? ORDER BY at DESC, rowid DESC').all(id) as Row[]).map((f) => ({
      id: f.id as string,
      kind: f.kind as FeedItem['kind'],
      emoji: f.emoji as string,
      text: f.text as string,
      at: Number(f.at),
      reactions: JSON.parse(f.reactions_json as string),
      comments: JSON.parse(f.comments_json as string),
    }));
    const history: SeasonArchive[] = (db.prepare('SELECT archive_json FROM seasons WHERE league_id = ? ORDER BY season').all(id) as Row[]).map((r) => JSON.parse(r.archive_json as string));

    const league: League = {
      id,
      code: l.code as string,
      config: JSON.parse(l.config_json as string) as LeagueConfig,
      status: l.status as League['status'],
      season,
      createdAt: Number(l.created_at),
      members,
      teams,
      customItems,
      pool: JSON.parse(l.pool_json as string),
      auction,
      tournament,
      standings,
      feed,
      awards,
      history,
      version: Number(l.version),
    };

    // match results of the current season
    const resultsOut: MatchResult[] = [];
    for (const m of matchRows) {
      if (!m.result_json) continue;
      const rest = JSON.parse(m.result_json as string) as Omit<MatchResult, 'events' | 'playerStats'>;
      const events: MatchEvent[] = (db.prepare('SELECT * FROM match_events WHERE match_id = ? ORDER BY seq').all(m.id as string) as Row[]).map((e) => ({
        seq: Number(e.seq),
        t: Number(e.t),
        minute: Number(e.minute),
        ...(e.extra !== null ? { extra: Number(e.extra) } : {}),
        type: e.type as MatchEvent['type'],
        teamId: (e.team_id as string) ?? null,
        playerId: (e.player_id as string) ?? null,
        secondaryPlayerId: (e.secondary_player_id as string) ?? null,
        importance: Number(e.importance) as MatchEvent['importance'],
        homeGoals: Number(e.home_goals),
        awayGoals: Number(e.away_goals),
        ...(e.xg !== null ? { xg: Number(e.xg) } : {}),
        ...(e.detail !== null ? { detail: e.detail as string } : {}),
        commentary: e.commentary as string,
      }));
      const playerStats: PlayerMatchStats[] = (db.prepare('SELECT * FROM statistics WHERE match_id = ?').all(m.id as string) as Row[]).map((s) => ({
        playerId: s.player_id as string,
        teamId: s.team_id as string,
        rating: Number(s.rating),
        goals: Number(s.goals),
        assists: Number(s.assists),
        shots: Number(s.shots),
        shotsOnTarget: Number(s.shots_on_target),
        passes: Number(s.passes),
        keyPasses: Number(s.key_passes),
        dribbles: Number(s.dribbles),
        tackles: Number(s.tackles),
        saves: Number(s.saves),
        goalsConceded: Number(s.goals_conceded),
        yellow: Number(s.yellow),
        red: Number(s.red),
        xg: Number(s.xg),
        cleanSheet: bool(s.clean_sheet),
      }));
      resultsOut.push({ ...rest, events, playerStats });
    }
    return { league, results: resultsOut };
  }
}
