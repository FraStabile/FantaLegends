/**
 * Relational schema. Critical invariants are enforced by the database too
 * (defence in depth on top of the authoritative engine):
 *  - an item can be owned once per league season      → UNIQUE(league_id, season, item_id)
 *  - a user joins a league once                        → UNIQUE(league_id, user_id)
 *  - invite codes are unique                           → UNIQUE(code)
 *  - bids are idempotent                               → PRIMARY KEY(id)
 *  - credits never go negative                          → CHECK(credits >= 0)
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    display_name  TEXT NOT NULL,
    avatar        TEXT NOT NULL DEFAULT '⚽',
    token_hash    TEXT NOT NULL UNIQUE,
    push_token    TEXT,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leagues (
    id            TEXT PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('lobby','auction','pre_season','season','completed')),
    season        INTEGER NOT NULL DEFAULT 1,
    config_json   TEXT NOT NULL,
    pool_json     TEXT NOT NULL DEFAULT '[]',
    tournament_json TEXT,
    version       INTEGER NOT NULL DEFAULT 1,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id            TEXT NOT NULL,
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    owner_id      TEXT NOT NULL,
    name          TEXT NOT NULL,
    logo_emoji    TEXT NOT NULL,
    logo_color    TEXT NOT NULL,
    credits       INTEGER NOT NULL CHECK (credits >= 0),
    position      INTEGER NOT NULL,
    PRIMARY KEY (league_id, id)
  );

  CREATE TABLE IF NOT EXISTS league_members (
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL,
    team_id       TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    avatar        TEXT NOT NULL,
    is_master     INTEGER NOT NULL DEFAULT 0,
    ready         INTEGER NOT NULL DEFAULT 0,
    bot           TEXT,
    joined_at     INTEGER NOT NULL,
    PRIMARY KEY (league_id, user_id),
    FOREIGN KEY (league_id, team_id) REFERENCES teams(league_id, id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_members_user ON league_members(user_id);

  -- catalog: seed items (league_id NULL) and league-specific custom / AI items
  CREATE TABLE IF NOT EXISTS players (
    id            TEXT NOT NULL,
    league_id     TEXT REFERENCES leagues(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    nationality   TEXT NOT NULL,
    position      TEXT NOT NULL CHECK (position IN ('GK','DF','MF','FW')),
    prime_period  TEXT NOT NULL,
    overall       INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 99),
    era           TEXT NOT NULL,
    rarity        TEXT NOT NULL,
    base_value    INTEGER NOT NULL,
    source        TEXT NOT NULL,
    data_json     TEXT NOT NULL,
    PRIMARY KEY (id, league_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_players_catalog ON players(id) WHERE league_id IS NULL;

  CREATE TABLE IF NOT EXISTS managers (
    id            TEXT NOT NULL,
    league_id     TEXT REFERENCES leagues(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    overall       INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 99),
    tactic        TEXT NOT NULL,
    source        TEXT NOT NULL,
    data_json     TEXT NOT NULL,
    PRIMARY KEY (id, league_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_managers_catalog ON managers(id) WHERE league_id IS NULL;

  CREATE TABLE IF NOT EXISTS auctions (
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season        INTEGER NOT NULL,
    status        TEXT NOT NULL,
    lot_counter   INTEGER NOT NULL DEFAULT 0,
    -- runtime state of the authoritative engine (queue is secret, never exposed)
    state_json    TEXT NOT NULL,
    PRIMARY KEY (league_id, season)
  );

  CREATE TABLE IF NOT EXISTS auction_lots (
    id            TEXT PRIMARY KEY,
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season        INTEGER NOT NULL,
    number        INTEGER NOT NULL,
    item_id       TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('player','coach')),
    slot          TEXT NOT NULL,
    team_id       TEXT,
    price         INTEGER NOT NULL CHECK (price >= 0),
    bid_count     INTEGER NOT NULL DEFAULT 0,
    auto_assigned INTEGER NOT NULL DEFAULT 0,
    closed_at     INTEGER NOT NULL,
    seq           INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_lots_league ON auction_lots(league_id, season, seq);

  CREATE TABLE IF NOT EXISTS auction_bids (
    id            TEXT PRIMARY KEY,
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    lot_id        TEXT NOT NULL,
    team_id       TEXT NOT NULL,
    amount        INTEGER NOT NULL CHECK (amount > 0),
    at            INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bids_lot ON auction_bids(lot_id, at);

  CREATE TABLE IF NOT EXISTS team_players (
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season        INTEGER NOT NULL,
    team_id       TEXT NOT NULL,
    item_id       TEXT NOT NULL,
    kind          TEXT NOT NULL,
    slot          TEXT NOT NULL,
    price         INTEGER NOT NULL CHECK (price >= 0),
    lot_number    INTEGER NOT NULL,
    auto_assigned INTEGER NOT NULL DEFAULT 0,
    seq           INTEGER NOT NULL,
    UNIQUE (league_id, season, item_id),
    FOREIGN KEY (league_id, team_id) REFERENCES teams(league_id, id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id            TEXT PRIMARY KEY,
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season        INTEGER NOT NULL,
    round         INTEGER NOT NULL,
    stage         TEXT NOT NULL,
    grp           TEXT,
    home_team_id  TEXT NOT NULL,
    away_team_id  TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('scheduled','live','finished')),
    seed          INTEGER NOT NULL,
    kickoff_at    INTEGER,
    home_goals    INTEGER,
    away_goals    INTEGER,
    home_pens     INTEGER,
    away_pens     INTEGER,
    mvp_player_id TEXT,
    -- full simulation output (lineups, team stats, highlights): written once, when simulated
    result_json   TEXT,
    CHECK (home_team_id <> away_team_id)
  );
  CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id, season, round);

  CREATE TABLE IF NOT EXISTS match_events (
    match_id      TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    seq           INTEGER NOT NULL,
    t             REAL NOT NULL,
    minute        INTEGER NOT NULL,
    extra         INTEGER,
    type          TEXT NOT NULL,
    team_id       TEXT,
    player_id     TEXT,
    secondary_player_id TEXT,
    importance    INTEGER NOT NULL,
    home_goals    INTEGER NOT NULL,
    away_goals    INTEGER NOT NULL,
    xg            REAL,
    detail        TEXT,
    commentary    TEXT NOT NULL,
    PRIMARY KEY (match_id, seq)
  );

  -- per player per match statistics (source of season statistics)
  CREATE TABLE IF NOT EXISTS statistics (
    match_id      TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    league_id     TEXT NOT NULL,
    season        INTEGER NOT NULL,
    player_id     TEXT NOT NULL,
    team_id       TEXT NOT NULL,
    rating        REAL NOT NULL,
    goals         INTEGER NOT NULL,
    assists       INTEGER NOT NULL,
    shots         INTEGER NOT NULL,
    shots_on_target INTEGER NOT NULL,
    passes        INTEGER NOT NULL,
    key_passes    INTEGER NOT NULL,
    dribbles      INTEGER NOT NULL,
    tackles       INTEGER NOT NULL,
    saves         INTEGER NOT NULL,
    goals_conceded INTEGER NOT NULL,
    yellow        INTEGER NOT NULL,
    red           INTEGER NOT NULL,
    xg            REAL NOT NULL,
    clean_sheet   INTEGER NOT NULL,
    PRIMARY KEY (match_id, player_id)
  );
  CREATE INDEX IF NOT EXISTS idx_stats_league ON statistics(league_id, season);

  CREATE TABLE IF NOT EXISTS standings (
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season        INTEGER NOT NULL,
    team_id       TEXT NOT NULL,
    grp           TEXT,
    position      INTEGER NOT NULL,
    played        INTEGER NOT NULL,
    won           INTEGER NOT NULL,
    drawn         INTEGER NOT NULL,
    lost          INTEGER NOT NULL,
    goals_for     INTEGER NOT NULL,
    goals_against INTEGER NOT NULL,
    points        INTEGER NOT NULL,
    form          TEXT NOT NULL,
    PRIMARY KEY (league_id, season, team_id)
  );

  CREATE TABLE IF NOT EXISTS awards (
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season        INTEGER NOT NULL,
    award_key     TEXT NOT NULL,
    title         TEXT NOT NULL,
    team_id       TEXT,
    item_id       TEXT,
    value         TEXT NOT NULL,
    description   TEXT NOT NULL,
    PRIMARY KEY (league_id, season, award_key)
  );

  CREATE TABLE IF NOT EXISTS feed_items (
    id            TEXT PRIMARY KEY,
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL,
    emoji         TEXT NOT NULL,
    text          TEXT NOT NULL,
    at            INTEGER NOT NULL,
    reactions_json TEXT NOT NULL DEFAULT '{}',
    comments_json TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_feed_league ON feed_items(league_id, at DESC);

  -- Albo d'oro: frozen snapshot of every completed season
  CREATE TABLE IF NOT EXISTS seasons (
    league_id     TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season        INTEGER NOT NULL,
    champion_team_id TEXT,
    champion_name TEXT NOT NULL,
    finished_at   INTEGER NOT NULL,
    archive_json  TEXT NOT NULL,
    PRIMARY KEY (league_id, season)
  );
  `,
];
