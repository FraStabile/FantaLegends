import type {
  Coach,
  MatchEvent,
  MatchEventType,
  MatchLineup,
  MatchResult,
  Player,
  PlayerMatchStats,
  TalkEffect,
  Team,
  TeamMatchStats,
} from '../domain/types';
import { createRng, type Rng } from '../util/rng';
import { baseMultipliers, combine, moraleSwing, situationalMultipliers, type SideMultipliers } from './coachModifiers';
import { formationLabel, tacticFitMultiplier } from './tactics';
import { strengthView, zoneRatings, type ZoneRatings } from './teamStrength';
import { computeRatings } from './ratings';
import type { NarrationInput, Narrator } from '../commentary/narrator';

// ───────────────────────────── Public API ─────────────────────────────

export interface MatchSide {
  team: Team;
  players: Player[];
  coach: Coach | null;
  /** −1 … +1 from recent results */
  form: number;
  /** −1 … +1 */
  morale: number;
  /** effect of the pre-match team talk, if any */
  talk?: TalkEffect;
}

export interface MatchInput {
  matchId: string;
  seed: number;
  home: MatchSide;
  away: MatchSide;
  /** home advantage enabled by league rules */
  homeAdvantage: boolean;
  /** knockout ties cannot end in a draw → penalty shoot-out */
  knockout: boolean;
  narrator: Narrator;
}

/**
 * MatchEngine — probabilistic, minute-by-minute simulation.
 *
 * The final score is never decided up front: it is the sum of the goals that
 * happen in the simulated events. Every minute the engine
 *   1. updates fatigue and morale,
 *   2. recomputes zone ratings (attack / midfield / defense / goalkeeping) from the
 *      individual stats of the players still on the pitch, scaled by coach, tactic,
 *      home advantage, form, morale and game state,
 *   3. decides who has the ball (midfield control vs midfield control),
 *   4. resolves an attacking action: chance creation vs defensive resistance,
 *      pressing turnovers and counter attacks, fouls, set pieces, errors,
 *   5. resolves shots with individual duels: shooter finishing/composure vs
 *      defender pressure vs goalkeeper reflexes/diving/handling.
 * Randomness is seeded and bounded: the stronger side creates more and better
 * chances on average, but any single match can go the other way.
 */
export function simulateMatch(input: MatchInput): MatchResult {
  return new Simulation(input).run();
}

// ───────────────────────────── Internals ─────────────────────────────

type ChanceKind = 'through_ball' | 'cross' | 'cutback' | 'solo' | 'long_shot' | 'counter' | 'one_on_one' | 'free_kick' | 'corner' | 'volley';

const BASE_XG: Record<ChanceKind, number> = {
  through_ball: 0.19,
  cross: 0.1,
  cutback: 0.21,
  solo: 0.16,
  long_shot: 0.045,
  counter: 0.24,
  one_on_one: 0.36,
  free_kick: 0.07,
  corner: 0.075,
  volley: 0.11,
};

interface LivePlayer {
  p: Player;
  side: 0 | 1;
  active: boolean;
  fatigue: number;
  knock: number;
  yellow: number;
  stats: PlayerMatchStats;
  errors: number;
  bigMisses: number;
  short: string;
}

interface Side {
  idx: 0 | 1;
  input: MatchSide;
  players: LivePlayer[];
  base: SideMultipliers;
  fit: number;
  goals: number;
  pens: number;
  morale: number;
  ticks: number;
  stats: TeamMatchStats;
  name: string;
  talk: TalkEffect;
}

const NO_TALK: TalkEffect = { morale: 0, discipline: 1, focus: 1 };

function emptyTeamStats(): TeamMatchStats {
  return { possession: 50, shots: 0, shotsOnTarget: 0, xg: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, passes: 0, dribbles: 0, tackles: 0, saves: 0, bigChances: 0 };
}

/** Short names for commentary: surname, disambiguated when two players share it. */
function shortNames(players: Player[]): Map<string, string> {
  const particles = new Set(['van', 'de', 'del', 'di', 'da', 'der', 'dos', 'ter', 'la', 'le']);
  const shortOf = (name: string) => {
    const parts = name.split(' ');
    if (parts.length === 1) return name;
    let i = parts.length - 1;
    while (i > 0 && particles.has(parts[i - 1].toLowerCase())) i--;
    return parts.slice(i).join(' ');
  };
  const counts = new Map<string, number>();
  for (const p of players) counts.set(shortOf(p.name), (counts.get(shortOf(p.name)) ?? 0) + 1);
  return new Map(players.map((p) => [p.id, counts.get(shortOf(p.name))! > 1 ? p.name : shortOf(p.name)]));
}

class Simulation {
  private readonly rng: Rng;
  private readonly sides: [Side, Side];
  private readonly events: MatchEvent[] = [];
  private minute = 0;
  private extra = 0;
  /** timeline clock (see MatchEvent.t) and events already placed in the current tick */
  private clock = 0;
  private inTick = 0;
  private seq = 0;
  private bestGoal: MatchResult['highlights']['bestGoal'] = null;
  private bestSave: MatchResult['highlights']['bestSave'] = null;
  /** goals conceded while trailing by 2+, for the comeback tail */
  private maxDeficit: [number, number] = [0, 0];

  constructor(private readonly input: MatchInput) {
    this.rng = createRng(input.seed);
    const names = shortNames([...input.home.players, ...input.away.players]);
    const mkSide = (idx: 0 | 1, s: MatchSide): Side => ({
      idx,
      input: s,
      players: s.players.map((p) => ({
        p,
        side: idx,
        active: true,
        fatigue: 0,
        knock: 0,
        yellow: 0,
        errors: 0,
        bigMisses: 0,
        short: names.get(p.id)!,
        stats: {
          playerId: p.id, teamId: s.team.id, rating: 6, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0,
          keyPasses: 0, dribbles: 0, tackles: 0, saves: 0, goalsConceded: 0, yellow: 0, red: 0, xg: 0, cleanSheet: false,
        },
      })),
      base: baseMultipliers(s.coach),
      fit: tacticFitMultiplier(s.coach, s.players),
      goals: 0,
      pens: 0,
      // the team talk lands on top of form and morale, then fades like any other mood
      morale: Math.max(-0.12, Math.min(0.12, s.morale * 0.06 + s.form * 0.05)) + (s.talk?.morale ?? 0),
      ticks: 0,
      stats: emptyTeamStats(),
      name: s.team.name,
      talk: s.talk ?? NO_TALK,
    });
    this.sides = [mkSide(0, input.home), mkSide(1, input.away)];
  }

  run(): MatchResult {
    const [home, away] = this.sides;
    this.emit({ type: 'kickoff', importance: 2, side: null });

    const firstStoppage = this.rng.int(0, 3);
    for (let m = 1; m <= 45 + firstStoppage; m++) {
      this.minute = Math.min(m, 45);
      this.extra = m > 45 ? m - 45 : 0;
      this.setClock(m);
      this.tick();
    }
    this.minute = 45;
    this.extra = 0;
    this.setClock(45 + firstStoppage + 1);
    this.emit({ type: 'halftime', importance: 2, side: null });
    // half-time: partial recovery
    for (const s of this.sides) for (const lp of s.players) lp.fatigue *= 0.8;

    const secondStoppage = this.rng.int(1, 5);
    const breakLen = 2;
    for (let m = 46; m <= 90 + secondStoppage; m++) {
      this.minute = Math.min(m, 90);
      this.extra = m > 90 ? m - 90 : 0;
      this.setClock(m + firstStoppage + breakLen);
      this.tick();
    }
    this.minute = 90;
    this.extra = secondStoppage;
    this.setClock(90 + secondStoppage + firstStoppage + breakLen + 1);

    let homePens: number | null = null;
    let awayPens: number | null = null;
    if (this.input.knockout && home.goals === away.goals) {
      this.shootout();
      this.setClock(this.clock + 1);
      homePens = home.pens;
      awayPens = away.pens;
    }
    const winner = home.goals !== away.goals ? (home.goals > away.goals ? home : away) : homePens !== null ? (home.pens > away.pens ? home : away) : null;
    this.emit({ type: 'fulltime', importance: 3, side: winner, detail: winner ? 'win' : 'draw' });

    const totalTicks = home.ticks + away.ticks || 1;
    home.stats.possession = Math.round((home.ticks / totalTicks) * 100);
    away.stats.possession = 100 - home.stats.possession;
    for (const s of this.sides) s.stats.xg = Math.round(s.stats.xg * 100) / 100;

    const playerStats = computeRatings(
      this.sides.map((s) => ({
        teamId: s.input.team.id,
        goalsFor: s.goals,
        goalsAgainst: this.other(s).goals,
        won: winner === s,
        lost: winner !== null && winner !== s,
        players: s.players.map((lp) => ({ player: lp.p, stats: lp.stats, errors: lp.errors, bigMisses: lp.bigMisses })),
      })),
      this.rng,
    );
    const mvp = playerStats.reduce<PlayerMatchStats | null>((best, ps) => (!best || ps.rating > best.rating ? ps : best), null);

    return {
      matchId: this.input.matchId,
      homeGoals: home.goals,
      awayGoals: away.goals,
      homePens,
      awayPens,
      events: this.events,
      homeStats: home.stats,
      awayStats: away.stats,
      playerStats,
      mvpPlayerId: mvp?.playerId ?? null,
      lineups: { home: this.lineup(home), away: this.lineup(away) },
      totalTime: this.clock,
      highlights: { bestGoal: this.bestGoal, bestSave: this.bestSave },
    };
  }

  // ── minute tick

  private tick(): void {
    this.updateCondition();

    const z = this.sides.map((s) => this.effective(s)) as [Effective, Effective];
    const ctrl = z.map((e) => e.zones.midfield * e.mul.control * e.mul.midfield);
    const pHome = Math.pow(ctrl[0], 3) / (Math.pow(ctrl[0], 3) + Math.pow(ctrl[1], 3));
    const att = this.rng.chance(pHome) ? this.sides[0] : this.sides[1];
    const def = this.other(att);
    att.ticks++;
    const A = z[att.idx];
    const D = z[def.idx];

    // passing volume, for statistics
    const passes = Math.round(this.rng.int(4, 9) * A.mul.control);
    att.stats.passes += passes;
    for (let i = 0; i < passes; i++) this.pickOutfield(att, (lp) => (lp.p.position === 'MF' ? 3 : lp.p.position === 'DF' ? 2 : 1.2) * lp.p.stats.passing)!.stats.passes++;

    // rare random events
    if (this.rng.chance(0.0035 * (1.4 - this.avgStat(def, 'composure') / 100) * 3 * def.talk.focus)) return this.defensiveError(att, def);
    if (this.rng.chance(0.0045)) this.injury(this.rng.chance(0.5) ? att : def);

    // attacking action?
    const pAction = 0.4 * A.mul.tempo;
    if (!this.rng.chance(pAction)) {
      if (this.rng.chance(0.14)) this.colourPass(att);
      else if (this.rng.chance(0.2)) {
        // offender and victim are always on opposite sides
        const offender = this.rng.chance(0.6) ? def : att;
        this.foul(offender, this.other(offender), false);
      }
      return;
    }

    const threat = A.zones.attack * A.mul.attack;
    const resist = D.zones.defense * D.mul.defense;
    const pChance = clamp(0.28 * Math.pow(threat / resist, 1.8), 0.08, 0.6);
    const pTurnover = clamp(0.28 * D.mul.pressing * Math.pow(D.zones.defense / Math.max(1, A.zones.midfield), 0.8), 0.1, 0.45);
    const roll = this.rng.next();

    if (roll < pChance) {
      this.createChance(att, def, A, D, null);
    } else if (roll < pChance + pTurnover) {
      this.turnover(def, att, D, z[att.idx]);
    } else if (this.rng.chance(0.3)) {
      this.foul(def, att, this.rng.chance(0.35));
    } else if (this.rng.chance(0.22)) {
      this.corner(att, def);
    } else if (this.rng.chance(0.3)) {
      this.dribbleColour(att, def);
    }
  }

  private updateCondition(): void {
    for (const s of this.sides) {
      const pressing = s.base.pressing;
      for (const lp of s.players) {
        if (!lp.active) continue;
        const staminaFactor = 1.35 - lp.p.stats.stamina / 100;
        lp.fatigue += 0.0052 * staminaFactor * Math.pow(pressing, 1.5) * (lp.p.position === 'GK' ? 0.2 : 1);
      }
      // morale slowly returns to baseline
      s.morale *= 0.985;
    }
  }

  private condition(lp: LivePlayer): number {
    return Math.max(0.55, 1 - lp.fatigue * 0.35 - lp.knock);
  }

  private effective(s: Side): Effective {
    const zones = zoneRatings(s.players.map((lp) => ({ player: lp.p, condition: this.condition(lp), active: lp.active })));
    const diff = s.goals - this.other(s).goals;
    let mul = combine(s.base, situationalMultipliers(s.input.coach, diff, this.minute));
    const general = s.fit * (1 + s.morale * 0.5) * (this.input.homeAdvantage && s.idx === 0 ? 1.03 : 1);
    mul = { ...mul, attack: mul.attack * general, midfield: mul.midfield * general, defense: mul.defense * general };
    return { zones, mul };
  }

  // ── actions

  private createChance(att: Side, def: Side, A: Effective, D: Effective, forced: ChanceKind | null): void {
    const directness = (att.input.coach ? TACTIC_DIRECTNESS[att.input.coach.preferredTactic] : 1);
    const defenders = def.players.filter((lp) => lp.active && lp.p.position !== 'GK');
    const defPace = defenders.length ? defenders.reduce((s, lp) => s + lp.p.stats.pace, 0) / defenders.length : 50;

    const creator = this.pickOutfield(att, (lp) => (lp.p.position === 'MF' ? 3 : lp.p.position === 'FW' ? 1.6 : 0.8) * (lp.p.stats.passing + lp.p.stats.vision))!;
    const kind: ChanceKind =
      forced ??
      this.rng.weighted<ChanceKind>(['through_ball', 'cross', 'cutback', 'solo', 'long_shot', 'volley'], (k) => {
        switch (k) {
          case 'through_ball': return (creator.p.stats.vision / 70) * (2 - directness) * (1 + (75 - defPace) / 100);
          case 'cross': return (creator.p.stats.crossing / 75) * directness * 0.9;
          case 'cutback': return 0.7;
          case 'solo': return 0.9;
          case 'long_shot': return directness * 0.8;
          case 'volley': return 0.25;
          default: return 0;
        }
      });

    const shooter =
      kind === 'long_shot'
        ? this.pickOutfield(att, (lp) => (lp.p.position === 'FW' ? 2 : lp.p.position === 'MF' ? 2.2 : 0.6) * Math.pow(lp.p.stats.longShots / 60, 3))!
        : kind === 'cross' || kind === 'corner'
          ? this.pickOutfield(att, (lp) => (lp.p.position === 'FW' ? 4 : lp.p.position === 'DF' ? 1.4 : 1) * Math.pow(lp.p.stats.heading / 60, 3), creator)!
          : this.pickOutfield(att, (lp) => (lp.p.position === 'FW' ? 4 : lp.p.position === 'MF' ? 1.6 : 0.45) * Math.pow(lp.p.stats.finishing / 60, 2.5), kind === 'solo' ? undefined : creator)!;
    const defender = this.pickOutfield(def, (lp) => (lp.p.position === 'DF' ? 3 : lp.p.position === 'MF' ? 1.5 : 0.5) * lp.p.stats.defending);

    // solo action: dribble duel first
    if (kind === 'solo' && defender) {
      const atkSkill = (shooter.p.stats.dribbling * 0.6 + shooter.p.stats.acceleration * 0.25 + shooter.p.skillMoves * 3) * this.condition(shooter);
      const defSkill = (defender.p.stats.tackling * 0.5 + defender.p.stats.marking * 0.3 + defender.p.stats.pace * 0.2) * this.condition(defender);
      const pWin = clamp(0.5 + (atkSkill - defSkill) / 70, 0.2, 0.82);
      if (!this.rng.chance(pWin)) {
        defender.stats.tackles++;
        def.stats.tackles++;
        this.emit({ type: 'tackle', importance: 1, side: def, actor: defender, other: shooter });
        return;
      }
      shooter.stats.dribbles++;
      att.stats.dribbles++;
      this.emit({ type: 'dribble', importance: 1, side: att, actor: shooter, other: defender });
    } else if (kind !== 'long_shot') {
      const chanceDetail = kind === 'through_ball' || kind === 'cross' || kind === 'cutback' ? kind : undefined;
      this.emit({ type: 'chance', importance: 1, side: att, actor: creator, other: shooter, detail: chanceDetail });
    }

    let xg = BASE_XG[kind];
    const defQuality = defender ? (defender.p.stats.defending + defender.p.stats.marking) / 2 * this.condition(defender) : 40;
    xg *= clamp(1.3 - (defQuality - 55) / 90, 0.7, 1.35);
    const skillStat = kind === 'cross' || kind === 'corner' ? shooter.p.stats.heading : kind === 'long_shot' ? shooter.p.stats.longShots : shooter.p.stats.finishing;
    const skill = (skillStat * 0.75 + shooter.p.stats.composure * 0.25) * this.condition(shooter);
    xg *= Math.pow(skill / 78, 1.6);
    xg *= A.mul.attack / D.mul.defense;
    xg = clamp(xg, 0.02, 0.75);

    if (creator !== shooter && kind !== 'solo' && kind !== 'long_shot') creator.stats.keyPasses++;
    this.shoot(att, def, shooter, creator !== shooter ? creator : null, xg, kind, defender);
  }

  private shoot(att: Side, def: Side, shooter: LivePlayer, creator: LivePlayer | null, xg: number, kind: ChanceKind, blocker: LivePlayer | null): void {
    const big = xg >= 0.3;
    if (big) {
      att.stats.bigChances++;
      this.emit({ type: 'big_chance', importance: 2, side: att, actor: shooter, xg });
    }
    const shotDetail = kind === 'long_shot' ? 'long_shot' : kind === 'cross' || kind === 'corner' ? 'header' : undefined;
    this.emit({ type: 'shot', importance: 1, side: att, actor: shooter, xg, detail: shotDetail });
    shooter.stats.shots++;
    shooter.stats.xg += xg;
    att.stats.shots++;
    att.stats.xg += xg;

    const keeper = this.keeper(def);
    const gkSkill = keeper ? zoneOf(keeper.p) * this.condition(keeper) : 35;

    const canBlock = kind !== 'one_on_one' && kind !== 'counter' && blocker;
    if (canBlock && this.rng.chance(kind === 'long_shot' ? 0.2 : 0.09)) {
      this.emit({ type: 'blocked', importance: 1, side: att, actor: shooter, other: blocker });
      if (this.rng.chance(0.5)) this.corner(att, def);
      return;
    }

    const pGoal = clamp(0.82 * xg * Math.pow(80 / gkSkill, 1.7), 0.01, 0.85);
    if (this.rng.chance(pGoal)) {
      att.stats.shotsOnTarget++;
      shooter.stats.shotsOnTarget++;
      const assist = creator && kind !== 'solo' && kind !== 'long_shot' && this.rng.chance(0.85) ? creator : null;
      const detail = kind === 'cross' || kind === 'corner' ? 'header' : kind === 'long_shot' ? 'long_shot' : kind === 'one_on_one' ? 'one_on_one' : kind === 'free_kick' ? 'free_kick' : kind === 'volley' ? 'volley' : kind === 'solo' ? 'solo' : kind === 'counter' ? 'counter' : undefined;
      this.goal(att, def, shooter, assist, xg, detail);
      return;
    }

    const pOnTarget = clamp(0.3 + xg * 0.5 + (shooter.p.stats.composure - 70) / 200, 0.2, 0.75);
    if (keeper && this.rng.chance(pOnTarget)) {
      att.stats.shotsOnTarget++;
      shooter.stats.shotsOnTarget++;
      keeper.stats.saves++;
      def.stats.saves++;
      const detail = kind === 'cross' || kind === 'corner' ? 'header' : kind === 'long_shot' ? 'long_shot' : xg >= 0.3 ? 'one_on_one' : undefined;
      const ev = this.emit({ type: 'save', importance: xg >= 0.2 ? 3 : 2, side: def, actor: keeper, other: shooter, xg, detail });
      const score = xg * 10 + (detail === 'one_on_one' ? 2 : 0) + (this.minute >= 85 ? 1 : 0);
      if (!this.bestSave || score > this.bestSave.score) this.bestSave = { seq: ev.seq, playerId: keeper.p.id, teamId: def.input.team.id, score };
      if (this.rng.chance(0.45)) this.corner(att, def);
      return;
    }
    if (this.rng.chance(0.1)) {
      this.emit({ type: this.rng.chance(0.55) ? 'post' : 'crossbar', importance: 2, side: att, actor: shooter, xg });
      return;
    }
    if (big) shooter.bigMisses++;
    this.emit({ type: 'miss', importance: big ? 2 : 1, side: att, actor: shooter, xg, detail: shotDetail });
  }

  private goal(att: Side, def: Side, scorer: LivePlayer, assist: LivePlayer | null, xg: number, detail: string | undefined, ownGoal = false): void {
    const before = att.goals - def.goals;
    att.goals++;
    if (!ownGoal) {
      scorer.stats.goals++;
      if (assist) assist.stats.assists++;
    }
    for (const lp of def.players) if (lp.active) lp.stats.goalsConceded++;
    this.maxDeficit[att.idx] = Math.max(this.maxDeficit[att.idx], -before);
    att.morale += moraleSwing(att.input.coach, true);
    def.morale += moraleSwing(def.input.coach, false);

    const tails: string[] = [];
    const after = att.goals - def.goals;
    if (after === 0) tails.push('equalizer');
    else if (after === 1 && before === 0) tails.push(this.maxDeficit[att.idx] >= 2 ? 'comeback' : 'go_ahead');
    if (!ownGoal && scorer.stats.goals === 3) tails.push('hattrick');
    else if (!ownGoal && scorer.stats.goals === 2) tails.push('brace');
    if (this.minute >= 85 && after >= 0 && before <= 0) tails.push('late');

    const ev = this.emit({
      type: ownGoal ? 'own_goal' : 'goal',
      importance: 3,
      side: ownGoal ? def : att,
      actor: scorer,
      other: assist,
      xg,
      detail,
      tails,
      scoringSide: att,
    });
    if (!ownGoal) {
      const score = (1 - xg) * 10 + (detail === 'long_shot' || detail === 'free_kick' ? 3 : 0) + (detail === 'solo' || detail === 'volley' ? 2 : 0) + (tails.includes('late') ? 2 : 0);
      if (!this.bestGoal || score > this.bestGoal.score) this.bestGoal = { seq: ev.seq, playerId: scorer.p.id, teamId: att.input.team.id, score };
    }
  }

  private turnover(def: Side, att: Side, D: Effective, A: Effective): void {
    const winner = this.pickOutfield(def, (lp) => (lp.p.position === 'DF' ? 2.5 : lp.p.position === 'MF' ? 2 : 0.7) * (lp.p.stats.tackling + lp.p.stats.positioning));
    const loser = this.pickOutfield(att, (lp) => (lp.p.position === 'GK' ? 0 : 1) * 1);
    if (!winner) return;
    const interception = this.rng.chance(0.45);
    if (interception) {
      this.emit({ type: 'interception', importance: 1, side: def, actor: winner, other: loser });
    } else {
      winner.stats.tackles++;
      def.stats.tackles++;
      this.emit({ type: 'tackle', importance: 1, side: def, actor: winner, other: loser });
    }
    // fast break?
    const pCounter = clamp(0.2 * D.mul.counter * (A.mul.tempo > 1.05 ? 1.2 : 1), 0.05, 0.45);
    if (this.rng.chance(pCounter)) {
      const leader = this.pickOutfield(def, (lp) => (lp.p.position === 'FW' ? 3 : lp.p.position === 'MF' ? 1.5 : 0.4) * (lp.p.stats.pace + lp.p.stats.acceleration));
      this.emit({ type: 'counter', importance: 2, side: def, actor: leader ?? winner });
      const pOneOnOne = clamp(0.35 + ((leader?.p.stats.pace ?? 60) - this.avgStat(att, 'pace')) / 100, 0.15, 0.6);
      this.createChance(def, att, D, A, this.rng.chance(pOneOnOne) ? 'one_on_one' : 'counter');
    }
  }

  private foul(offender: Side, victim: Side, dangerous: boolean): void {
    const fouler = this.pickOutfield(offender, (lp) => (lp.p.position === 'DF' ? 2 : lp.p.position === 'MF' ? 1.6 : 0.8) * lp.p.stats.aggression);
    const fouled = this.pickOutfield(victim, (lp) => (lp.p.position === 'FW' ? 2 : 1) * lp.p.stats.dribbling);
    if (!fouler || !fouled) return;
    offender.stats.fouls++;
    this.emit({ type: 'foul', importance: 1, side: offender, actor: fouler, other: fouled });

    const pYellow = clamp((0.08 + (fouler.p.stats.aggression - 60) / 300 + (dangerous ? 0.08 : 0)) * offender.talk.discipline, 0.04, 0.3);
    if (this.rng.chance(0.005 * offender.talk.discipline)) {
      this.sendOff(offender, fouler);
    } else if (this.rng.chance(fouler.yellow ? pYellow * 0.45 : pYellow)) {
      fouler.yellow++;
      fouler.stats.yellow++;
      offender.stats.yellows++;
      this.emit({ type: 'yellow', importance: 2, side: offender, actor: fouler, other: fouled });
      if (fouler.yellow >= 2) this.sendOff(offender, fouler);
    }

    if (!dangerous) return;
    if (this.rng.chance(0.2)) {
      this.penalty(victim, offender, fouled);
    } else if (this.rng.chance(0.45)) {
      const taker = this.best(victim, (lp) => lp.p.stats.freeKick)!;
      const xg = clamp(0.03 + (taker.p.stats.freeKick - 60) / 600, 0.02, 0.12);
      this.shoot(victim, offender, taker, null, xg, 'free_kick', null);
    }
  }

  private penalty(att: Side, def: Side, winner: LivePlayer): void {
    this.emit({ type: 'penalty_awarded', importance: 3, side: att, actor: winner });
    const taker = this.best(att, (lp) => lp.p.stats.penalty * 0.8 + lp.p.stats.composure * 0.2)!;
    const keeper = this.keeper(def);
    const gk = keeper ? zoneOf(keeper.p) : 35;
    taker.stats.shots++;
    att.stats.shots++;
    taker.stats.xg += 0.76;
    att.stats.xg += 0.76;
    const pScore = clamp(0.74 + (taker.p.stats.penalty - gk) / 220 + (taker.p.stats.composure - 75) / 400, 0.5, 0.92);
    if (this.rng.chance(pScore)) {
      taker.stats.shotsOnTarget++;
      att.stats.shotsOnTarget++;
      // the penalty itself is the event; account the goal without a second "goal" line
      const before = att.goals - def.goals;
      att.goals++;
      taker.stats.goals++;
      for (const lp of def.players) if (lp.active) lp.stats.goalsConceded++;
      att.morale += moraleSwing(att.input.coach, true);
      def.morale += moraleSwing(def.input.coach, false);
      const after = att.goals - def.goals;
      const tails: string[] = [];
      if (after === 0) tails.push('equalizer');
      else if (after === 1 && before === 0) tails.push('go_ahead');
      if (taker.stats.goals === 2) tails.push('brace');
      if (taker.stats.goals === 3) tails.push('hattrick');
      if (this.minute >= 85 && after >= 0 && before <= 0) tails.push('late');
      this.emit({ type: 'penalty_scored', importance: 3, side: att, actor: taker, other: keeper, tails, scoringSide: att, xg: 0.76 });
    } else if (keeper && this.rng.chance(0.6)) {
      att.stats.shotsOnTarget++;
      taker.stats.shotsOnTarget++;
      keeper.stats.saves++;
      def.stats.saves++;
      const ev = this.emit({ type: 'penalty_missed', importance: 3, side: def, actor: keeper, other: taker, detail: 'saved', xg: 0.76 });
      const score = 7.6 + 3;
      if (!this.bestSave || score > this.bestSave.score) this.bestSave = { seq: ev.seq, playerId: keeper.p.id, teamId: def.input.team.id, score };
    } else {
      taker.bigMisses++;
      this.emit({ type: 'penalty_missed', importance: 3, side: att, actor: taker, other: keeper, xg: 0.76 });
    }
  }

  private corner(att: Side, def: Side): void {
    att.stats.corners++;
    const taker = this.best(att, (lp) => lp.p.stats.crossing)!;
    this.emit({ type: 'corner', importance: 1, side: att, actor: taker });
    if (this.rng.chance(0.3)) {
      const z = this.sides.map((s) => this.effective(s));
      // own goal from a messy corner, very rare
      if (this.rng.chance(0.025)) {
        const unlucky = this.pickOutfield(def, (lp) => (lp.p.position === 'DF' ? 3 : 1));
        if (unlucky) return this.goal(att, def, unlucky, null, 0.05, undefined, true);
      }
      this.createChance(att, def, z[att.idx], z[def.idx], 'corner');
    }
  }

  private defensiveError(att: Side, def: Side): void {
    const culprit = this.pickOutfield(def, (lp) => (lp.p.position === 'DF' ? 2 : lp.p.position === 'GK' ? 0.6 : 1) * (110 - lp.p.stats.composure));
    if (!culprit) return;
    culprit.errors++;
    this.emit({ type: 'defensive_error', importance: 2, side: def, actor: culprit });
    const z = this.sides.map((s) => this.effective(s));
    this.createChance(att, def, z[att.idx], z[def.idx], 'one_on_one');
  }

  private injury(side: Side): void {
    const victim = this.pickOutfield(side, () => 1);
    if (!victim) return;
    const leaves = this.rng.chance(0.3);
    this.emit({ type: 'injury', importance: 2, side, actor: victim, detail: leaves ? 'out' : 'knock' });
    if (leaves) victim.active = false;
    else victim.knock += 0.08;
  }

  private sendOff(side: Side, lp: LivePlayer): void {
    lp.active = false;
    lp.stats.red++;
    side.stats.reds++;
    side.morale -= 0.04;
    this.emit({ type: 'red', importance: 3, side, actor: lp });
  }

  private colourPass(att: Side): void {
    const from = this.pickOutfield(att, (lp) => lp.p.stats.passing);
    const to = from ? this.pickOutfield(att, () => 1, from) : null;
    if (from && to) this.emit({ type: 'pass', importance: 1, side: att, actor: from, other: to });
  }

  private dribbleColour(att: Side, def: Side): void {
    const dribbler = this.pickOutfield(att, (lp) => Math.pow(lp.p.stats.dribbling / 60, 3));
    const opponent = this.pickOutfield(def, (lp) => lp.p.stats.defending);
    if (!dribbler || !opponent) return;
    dribbler.stats.dribbles++;
    att.stats.dribbles++;
    this.emit({ type: 'dribble', importance: 1, side: att, actor: dribbler, other: opponent });
  }

  private shootout(): void {
    const [home, away] = this.sides;
    this.emit({ type: 'shootout_start', importance: 3, side: null });
    const order = (s: Side) => s.players.filter((lp) => lp.active).sort((a, b) => b.p.stats.penalty - a.p.stats.penalty);
    const takers: [LivePlayer[], LivePlayer[]] = [order(home), order(away)];
    const kick = (s: Side, round: number) => {
      this.setClock(this.clock + 0.5);
      const list = takers[s.idx];
      const taker = list[round % list.length];
      const keeper = this.keeper(this.other(s));
      const gk = keeper ? zoneOf(keeper.p) : 35;
      const p = clamp(0.74 + (taker.p.stats.penalty - gk) / 220 + (taker.p.stats.composure - 75) / 350 - (round >= 5 ? 0.04 : 0), 0.45, 0.92);
      const scored = this.rng.chance(p);
      if (scored) s.pens++;
      this.emit({ type: 'shootout_kick', importance: 3, side: s, actor: taker, other: keeper, detail: scored ? 'scored' : 'missed' });
    };
    for (let r = 0; r < 5; r++) {
      kick(home, r);
      if (decided(home.pens, away.pens, r + 1, r)) break;
      kick(away, r);
      if (decided(home.pens, away.pens, r + 1, r + 1)) break;
    }
    let r = 5;
    while (home.pens === away.pens && r < 30) {
      kick(home, r);
      kick(away, r);
      r++;
    }
    function decided(h: number, a: number, homeKicks: number, awayKicks: number): boolean {
      return h + (5 - homeKicks) < a || a + (5 - awayKicks) < h;
    }
  }

  // ── helpers

  private setClock(value: number): void {
    this.clock = value;
    this.inTick = 0;
  }

  private other(s: Side): Side {
    return this.sides[s.idx === 0 ? 1 : 0];
  }

  private keeper(s: Side): LivePlayer | null {
    return s.players.find((lp) => lp.active && lp.p.position === 'GK') ?? null;
  }

  private pickOutfield(s: Side, weight: (lp: LivePlayer) => number, exclude?: LivePlayer): LivePlayer | null {
    const pool = s.players.filter((lp) => lp.active && lp.p.position !== 'GK' && lp !== exclude);
    if (pool.length === 0) {
      const any = s.players.filter((lp) => lp.active && lp !== exclude);
      return any.length ? this.rng.pick(any) : null;
    }
    return this.rng.weighted(pool, (lp) => Math.max(0.01, weight(lp)));
  }

  private best(s: Side, score: (lp: LivePlayer) => number): LivePlayer | null {
    const pool = s.players.filter((lp) => lp.active);
    if (!pool.length) return null;
    return pool.reduce((a, b) => (score(b) > score(a) ? b : a));
  }

  private avgStat(s: Side, key: keyof Player['stats']): number {
    const pool = s.players.filter((lp) => lp.active && lp.p.position !== 'GK');
    if (!pool.length) return 50;
    return pool.reduce((sum, lp) => sum + lp.p.stats[key], 0) / pool.length;
  }

  private lineup(s: Side): MatchLineup {
    const c = s.input.coach;
    return {
      teamId: s.input.team.id,
      coachId: c?.id ?? null,
      tactic: c?.preferredTactic ?? 'balanced',
      formation: formationLabel(s.input.players),
      players: s.input.players.map((p) => ({ playerId: p.id, name: p.name, position: p.position, overall: p.overall })),
      strength: strengthView(s.input.players, c),
    };
  }

  private emit(e: {
    type: MatchEventType;
    importance: 1 | 2 | 3;
    side: Side | null;
    actor?: LivePlayer | null;
    other?: LivePlayer | null;
    xg?: number;
    detail?: string;
    tails?: string[];
    scoringSide?: Side;
  }): MatchEvent {
    const [home, away] = this.sides;
    const narration: NarrationInput = {
      type: e.type,
      detail: e.detail,
      tails: e.tails ?? [],
      p: e.actor?.short,
      o: e.other?.short,
      t: e.side?.name,
      opp: e.side ? this.other(e.side).name : undefined,
      score: `${home.goals}-${away.goals}`,
      minute: this.minute,
      home: home.name,
      away: away.name,
    };
    const t = Math.round((this.clock - 1 + Math.min(0.9, this.inTick++ * 0.18)) * 100) / 100;
    const event: MatchEvent = {
      seq: this.seq++,
      t: Math.max(0, t),
      minute: this.minute,
      ...(this.extra ? { extra: this.extra } : {}),
      type: e.type,
      teamId: e.side?.input.team.id ?? null,
      playerId: e.actor?.p.id ?? null,
      secondaryPlayerId: e.other?.p.id ?? null,
      importance: e.importance,
      homeGoals: home.goals,
      awayGoals: away.goals,
      ...(e.xg !== undefined ? { xg: Math.round(e.xg * 100) / 100 } : {}),
      ...(e.detail ? { detail: e.detail } : {}),
      commentary: this.input.narrator(narration),
    };
    this.events.push(event);
    return event;
  }
}

interface Effective {
  zones: ZoneRatings;
  mul: SideMultipliers;
}

const TACTIC_DIRECTNESS: Record<Coach['preferredTactic'], number> = {
  possession: 0.75,
  gegenpress: 0.95,
  counter: 1.1,
  catenaccio: 1.05,
  balanced: 1,
  direct: 1.35,
  total_football: 0.85,
};

function zoneOf(p: Player): number {
  const s = p.stats;
  return s.diving * 0.28 + s.reflexes * 0.3 + s.handling * 0.22 + s.positioning * 0.2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
