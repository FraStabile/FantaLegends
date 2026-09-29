import type {
  BotArchetype,
  League,
  MatchSummary,
  TalkEffect,
  TalkPhrase,
  TalkReaction,
  TalkTone,
  Team,
  TeamTalk,
} from '../domain/types';
import { DomainError } from '../domain/errors';
import { Catalog } from '../catalog/catalog';
import { TournamentEngine } from '../tournament/tournamentEngine';
import { formScore } from '../tournament/standings';
import { hashString } from '../util/rng';

// ───────────────────────────── Vocabulary ─────────────────────────────

export const TALK_PHRASES: { id: TalkPhrase; text: string }[] = [
  { id: 'prove_them_wrong', text: 'Nessuno crede in noi: facciamogli cambiare idea' },
  { id: 'we_are_better', text: 'Siete più forti di loro: fatelo vedere' },
  { id: 'enjoy_it', text: 'Niente pressione: andate là fuori e divertitevi' },
  { id: 'match_of_season', text: 'Questa partita vale una stagione intera' },
  { id: 'disappointed', text: "Sono deluso dall'ultima prestazione: pretendo una reazione" },
  { id: 'for_the_fans', text: 'Fatelo per la maglia e per i tifosi' },
];

export const TALK_TONES: { id: TalkTone; label: string; emoji: string }[] = [
  { id: 'calm', label: 'Calmo', emoji: '😌' },
  { id: 'passionate', label: 'Appassionato', emoji: '🔥' },
  { id: 'aggressive', label: 'Aggressivo', emoji: '😤' },
  { id: 'confident', label: 'Fiducioso', emoji: '🤝' },
];

export const TALK_REACTIONS: Record<TalkReaction, { emoji: string; label: string; text: string }> = {
  fired_up: { emoji: '🔥', label: 'Carichi a mille', text: 'I giocatori escono dallo spogliatoio con gli occhi di fuoco.' },
  focused: { emoji: '🎯', label: 'Concentrati', text: 'Sguardi seri, testa sulla partita: la squadra ha capito il messaggio.' },
  neutral: { emoji: '😐', label: 'Indifferenti', text: 'Qualche cenno di assenso, niente di più.' },
  complacent: { emoji: '😎', label: 'Troppo sicuri', text: 'Qualcuno sorride: sembrano convinti di averla già vinta.' },
  nervous: { emoji: '😬', label: 'Nervosi', text: 'Il discorso ha messo pressione: gambe tese e sguardi bassi.' },
};

// ───────────────────────────── Importance ─────────────────────────────

const KNOCKOUT_REASON: Partial<Record<MatchSummary['stage'], string>> = { final: 'Finale', semifinal: 'Semifinale', quarterfinal: 'Quarti di finale', round16: 'Ottavi di finale' };

/**
 * Why a match deserves a team talk, or null for an ordinary one. Talks are kept
 * for the matches that matter, so they stay a special moment.
 */
export function matchImportance(league: League, m: MatchSummary): string | null {
  const t = league.tournament;
  if (!t) return null;
  if (TournamentEngine.isKnockout(m)) {
    return KNOCKOUT_REASON[m.stage] ?? 'Eliminazione diretta';
  }
  const sameStage = t.matches.filter((x) => x.stage === m.stage && (m.stage !== 'group' || x.group === m.group));
  const lastRound = Math.max(...sameStage.map((x) => x.round));
  if (m.round === lastRound && lastRound > 1) return m.stage === 'group' ? 'Ultima giornata del girone' : 'Ultima giornata';

  const table = league.standings.filter((r) => r.group === m.group);
  const hi = table.findIndex((r) => r.teamId === m.homeTeamId);
  const ai = table.findIndex((r) => r.teamId === m.awayTeamId);
  if (hi < 0 || ai < 0 || table[hi].played < 2 || table.length < 4) return null;
  if (hi <= 1 && ai <= 1) return 'Scontro al vertice';
  if (Math.abs(hi - ai) === 1 && Math.abs(table[hi].points - table[ai].points) <= 3) return 'Scontro diretto';
  return null;
}

// ───────────────────────────── Context ─────────────────────────────

export interface TalkContext {
  /** −1 clear underdog … +1 clear favourite */
  favourite: number;
  /** −1 terrible run … +1 winning streak */
  form: number;
  lastResult: 'W' | 'D' | 'L' | null;
  /** 0…1 how much is at stake */
  stakes: number;
  /** coach motivation modifier (−5…+12), null without a coach */
  motivation: number | null;
}

function teamRating(team: Team, catalog: Catalog): number {
  const players = team.roster.filter((r) => r.kind === 'player').map((r) => catalog.find(r.itemId)?.overall ?? 70);
  const avg = players.length ? players.reduce((s, o) => s + o, 0) / players.length : 70;
  const coach = team.roster.find((r) => r.kind === 'coach');
  const coachOvr = coach ? (catalog.find(coach.itemId)?.overall ?? 80) : null;
  return avg + (coachOvr === null ? -2 : (coachOvr - 80) * 0.15);
}

const STAKES: Record<string, number> = { Finale: 1, Semifinale: 0.85, 'Quarti di finale': 0.7, 'Ottavi di finale': 0.6, 'Scontro al vertice': 0.75, 'Ultima giornata': 0.7 };

export function talkContext(league: League, m: MatchSummary, teamId: string): TalkContext {
  const catalog = new Catalog(league.customItems);
  const team = league.teams.find((t) => t.id === teamId)!;
  const oppId = m.homeTeamId === teamId ? m.awayTeamId : m.homeTeamId;
  const opp = league.teams.find((t) => t.id === oppId)!;
  const homeBonus = league.config.homeAway && m.stage !== 'final' ? (m.homeTeamId === teamId ? 1 : -1) : 0;
  const favourite = clamp((teamRating(team, catalog) - teamRating(opp, catalog) + homeBonus) / 6, -1, 1);
  const row = league.standings.find((r) => r.teamId === teamId);
  const coachId = team.roster.find((r) => r.kind === 'coach')?.itemId;
  const coach = coachId ? catalog.find(coachId) : undefined;
  const reason = matchImportance(league, m);
  return {
    favourite,
    form: formScore(row),
    lastResult: row?.form[row.form.length - 1] ?? null,
    stakes: reason ? (STAKES[reason] ?? 0.5) : 0.3,
    motivation: coach?.kind === 'coach' ? coach.modifiers.motivation : null,
  };
}

// ───────────────────────────── Evaluation ─────────────────────────────

/** How well a message suits the situation (−1…+1), before the tone. */
function phraseFit(phrase: TalkPhrase, c: TalkContext): number {
  switch (phrase) {
    case 'prove_them_wrong':
      return c.favourite <= -0.15 ? 0.5 - c.favourite * 0.5 : c.favourite > 0.3 ? -0.5 : 0;
    case 'we_are_better':
      return c.favourite >= 0.25 ? 0.6 : c.favourite <= -0.25 ? -0.6 : 0.1;
    case 'enjoy_it':
      return 0.1 + c.stakes * 0.4 - c.form * 0.4;
    case 'match_of_season':
      return -0.1 + c.form * 0.7 + c.stakes * 0.2;
    case 'disappointed':
      return c.lastResult === 'L' ? 0.7 : c.lastResult === 'D' ? 0.1 : c.lastResult === 'W' ? -0.8 : -0.4;
    case 'for_the_fans':
      return 0.25;
  }
}

/** Does the tone go with the words? An angry "enjoy yourselves" convinces nobody. */
const COHERENCE: Record<TalkPhrase, Record<TalkTone, number>> = {
  prove_them_wrong: { calm: -0.1, passionate: 0.3, aggressive: 0.2, confident: 0.2 },
  we_are_better: { calm: 0, passionate: 0.1, aggressive: -0.1, confident: 0.3 },
  enjoy_it: { calm: 0.3, passionate: 0, aggressive: -0.5, confident: 0.2 },
  match_of_season: { calm: -0.2, passionate: 0.3, aggressive: 0.1, confident: 0.1 },
  disappointed: { calm: 0.1, passionate: 0, aggressive: 0.3, confident: -0.4 },
  for_the_fans: { calm: 0, passionate: 0.3, aggressive: -0.1, confident: 0.1 },
};

/** Louder tones amplify the message and make the reaction less predictable. */
const TONE: Record<TalkTone, { magnitude: number; variance: number }> = {
  calm: { magnitude: 0.8, variance: 0.15 },
  passionate: { magnitude: 1.1, variance: 0.25 },
  aggressive: { magnitude: 1.25, variance: 0.4 },
  confident: { magnitude: 1, variance: 0.2 },
};

const EFFECTS: Record<TalkReaction, TalkEffect> = {
  fired_up: { morale: 0.1, discipline: 1.1, focus: 0.9 },
  focused: { morale: 0.05, discipline: 1, focus: 0.7 },
  neutral: { morale: 0, discipline: 1, focus: 1 },
  complacent: { morale: -0.05, discipline: 1, focus: 1.4 },
  nervous: { morale: -0.08, discipline: 1.3, focus: 1.3 },
};

/** Expected value of a talk, without the players' mood of the day. */
function expectedScore(phrase: TalkPhrase, tone: TalkTone, c: TalkContext): number {
  const coach = c.motivation === null ? 0.8 : 0.8 + clamp(c.motivation, -5, 12) / 30;
  return (phraseFit(phrase, c) + COHERENCE[phrase][tone]) * TONE[tone].magnitude * coach;
}

/**
 * Players' reaction to a talk. Deterministic for a given match, team and choice
 * (the server stays authoritative and a retry cannot "re-roll" the reaction), but
 * it carries a random part: the same words can land well or badly.
 */
export function evaluateTalk(phrase: TalkPhrase, tone: TalkTone, c: TalkContext, luckKey: string): { reaction: TalkReaction } & TalkEffect {
  const luck = (hashString(`${luckKey}|${phrase}|${tone}`) / 0xffffffff) * 2 - 1;
  const score = expectedScore(phrase, tone, c) + luck * TONE[tone].variance;
  const complacencyRisk = c.favourite > 0.35 && (phrase === 'we_are_better' || phrase === 'enjoy_it' || tone === 'calm' || tone === 'confident');
  const reaction: TalkReaction =
    score >= 0.6 ? 'fired_up' : score >= 0.25 ? 'focused' : score > -0.1 ? (complacencyRisk ? 'complacent' : 'neutral') : complacencyRisk ? 'complacent' : 'nervous';
  const base = EFFECTS[reaction];
  return {
    reaction,
    morale: base.morale,
    discipline: round2(base.discipline * (tone === 'aggressive' ? 1.15 : 1)),
    focus: round2(base.focus * (tone === 'calm' ? 0.9 : 1)),
  };
}

// ───────────────────────────── Commands ─────────────────────────────

/** The important match of the next round a team can still give a talk for. */
export function talkableMatch(league: League, teamId: string): MatchSummary | null {
  if (league.status !== 'season' || !league.tournament) return null;
  const m = TournamentEngine.pendingRound(league.tournament).find((x) => x.status === 'scheduled' && (x.homeTeamId === teamId || x.awayTeamId === teamId));
  return m && matchImportance(league, m) ? m : null;
}

export const TeamTalks = {
  give(league: League, teamId: string, matchId: string, phrase: TalkPhrase, tone: TalkTone, now: number): TeamTalk {
    const m = league.tournament?.matches.find((x) => x.id === matchId);
    if (!m) throw new DomainError('NOT_FOUND');
    if (talkableMatch(league, teamId)?.id !== matchId) throw new DomainError('INVALID_STATE', 'Discorso non disponibile per questa partita');
    if (m.talks?.some((t) => t.teamId === teamId)) throw new DomainError('INVALID_STATE', 'Hai già parlato alla squadra');
    if (!TALK_PHRASES.some((p) => p.id === phrase) || !TALK_TONES.some((t) => t.id === tone)) throw new DomainError('INVALID_INPUT');
    const outcome = evaluateTalk(phrase, tone, talkContext(league, m, teamId), `${m.id}|${teamId}`);
    const talk: TeamTalk = { teamId, phrase, tone, ...outcome, at: now };
    m.talks = [...(m.talks ?? []), talk];
    return talk;
  },

  /** Bots talk to their squad before the important matches, each in its own way. */
  giveBotTalks(league: League, round: MatchSummary[], now: number): void {
    for (const m of round) {
      if (!matchImportance(league, m)) continue;
      for (const teamId of [m.homeTeamId, m.awayTeamId]) {
        const bot = league.members.find((x) => x.teamId === teamId)?.bot;
        if (!bot || m.talks?.some((t) => t.teamId === teamId)) continue;
        const { phrase, tone } = botTalkChoice(bot, talkContext(league, m, teamId), `${m.id}|${teamId}`);
        TeamTalks.give(league, teamId, m.id, phrase, tone, now);
      }
    }
  },
};

const BOT_TONES: Partial<Record<BotArchetype, TalkTone>> = { shark: 'aggressive', saver: 'calm', fan: 'passionate', kamikaze: 'passionate', provocateur: 'aggressive' };

function botTalkChoice(bot: BotArchetype, c: TalkContext, key: string): { phrase: TalkPhrase; tone: TalkTone } {
  if (bot === 'gambler') {
    const h = hashString(`${key}|gambler`);
    return { phrase: TALK_PHRASES[h % TALK_PHRASES.length].id, tone: TALK_TONES[(h >>> 8) % TALK_TONES.length].id };
  }
  const tones = BOT_TONES[bot] ? [BOT_TONES[bot]!] : TALK_TONES.map((t) => t.id);
  let best = { phrase: TALK_PHRASES[0].id, tone: tones[0], score: -Infinity };
  for (const p of TALK_PHRASES) for (const tone of tones) {
    const score = expectedScore(p.id, tone, c);
    if (score > best.score) best = { phrase: p.id, tone, score };
  }
  return best;
}

// ───────────────────────────── View ─────────────────────────────

export interface TalkOffer {
  matchId: string;
  opponentTeamId: string;
  /** why the match matters ("Finale", "Scontro al vertice", …) */
  reason: string;
  /** what the dressing room looks like, for the user to read the situation */
  hints: string[];
  given: TeamTalk | null;
}

export function talkOffer(league: League, teamId: string): TalkOffer | null {
  const m = talkableMatch(league, teamId);
  if (!m) return null;
  const c = talkContext(league, m, teamId);
  const hints = [
    c.favourite >= 0.3 ? '📈 Siete i favoriti' : c.favourite <= -0.3 ? '📉 Partite sfavoriti' : '⚖️ Sfida equilibrata',
    c.form >= 0.4 ? '🔥 Squadra in forma' : c.form <= -0.4 ? '🥶 Momento difficile' : '〰️ Forma altalenante',
  ];
  if (c.lastResult) hints.push(c.lastResult === 'W' ? '✅ Veniamo da una vittoria' : c.lastResult === 'L' ? '❌ Veniamo da una sconfitta' : '➖ Veniamo da un pareggio');
  return {
    matchId: m.id,
    opponentTeamId: m.homeTeamId === teamId ? m.awayTeamId : m.homeTeamId,
    reason: matchImportance(league, m)!,
    hints,
    given: m.talks?.find((t) => t.teamId === teamId) ?? null,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
