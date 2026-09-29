import type { CompetitionFormat, CommentaryTone, MatchEvent, MatchStage, PlayStyle, Position, Slot, Tactic } from '@asta/core';

export const POSITION_IT: Record<Position, string> = { GK: 'Portiere', DF: 'Difensore', MF: 'Centrocampista', FW: 'Attaccante' };
export const SLOT_SHORT: Record<Slot, string> = { GK: 'POR', DF: 'DIF', MF: 'CEN', FW: 'ATT', COACH: 'ALL' };
export const SLOT_IT: Record<Slot, string> = { GK: 'Portiere', DF: 'Difensore', MF: 'Centrocampista', FW: 'Attaccante', COACH: 'Allenatore' };

export const FORMAT_IT: Record<CompetitionFormat, string> = {
  round_robin: 'Girone unico',
  double_round_robin: 'Andata e ritorno',
  groups_knockout: 'Gironi + eliminazione',
  knockout: 'Eliminazione diretta',
};

export const STAGE_IT: Record<MatchStage, string> = {
  league: 'Campionato',
  group: 'Girone',
  round16: 'Ottavi',
  quarterfinal: 'Quarti',
  semifinal: 'Semifinale',
  final: 'FINALE',
};

export const TONE_IT: Record<CommentaryTone, { label: string; emoji: string; hint: string }> = {
  classico: { label: 'Classico', emoji: '🎙️', hint: 'Telecronaca tradizionale' },
  epico: { label: 'Epico', emoji: '⚡', hint: 'Dramma e leggenda' },
  tecnico: { label: 'Tecnico', emoji: '📐', hint: 'Analisi e lavagna' },
  ironico: { label: 'Ironico', emoji: '😏', hint: 'Humour asciutto' },
  trash: { label: 'Trash', emoji: '🤪', hint: 'Senza freni' },
  bar_sport: { label: 'Bar Sport', emoji: '🍺', hint: 'Come al bar con gli amici' },
};

export const TACTIC_IT: Record<Tactic, string> = {
  possession: 'Possesso palla',
  gegenpress: 'Gegenpressing',
  counter: 'Contropiede',
  catenaccio: 'Catenaccio',
  balanced: 'Equilibrato',
  direct: 'Verticale',
  total_football: 'Calcio totale',
};

export const STYLE_IT: Record<PlayStyle, string> = {
  shot_stopper: 'Pararigori',
  sweeper_keeper: 'Portiere libero',
  stopper: 'Stopper',
  ball_playing_defender: 'Difensore costruttore',
  libero: 'Libero',
  wingback: 'Terzino fluidificante',
  regista: 'Regista',
  box_to_box: 'Box to box',
  ball_winner: 'Mediano di rottura',
  playmaker: 'Playmaker',
  trequartista: 'Trequartista',
  winger: 'Ala',
  poacher: 'Rapace d\'area',
  target_man: 'Centravanti boa',
  complete_forward: 'Attaccante completo',
  false_nine: 'Falso nueve',
  inside_forward: 'Ala a piede invertito',
  speedster: 'Freccia',
};

export const EVENT_ICON: Partial<Record<MatchEvent['type'], string>> = {
  kickoff: '🏁',
  halftime: '⏸️',
  fulltime: '🏁',
  goal: '⚽',
  own_goal: '🙈',
  penalty_scored: '⚽',
  penalty_missed: '❌',
  penalty_awarded: '🎯',
  save: '🧤',
  post: '🥅',
  crossbar: '🥅',
  shot: '👟',
  miss: '💨',
  blocked: '🧱',
  big_chance: '😱',
  chance: '✨',
  counter: '⚡',
  corner: '🚩',
  foul: '⚠️',
  yellow: '🟨',
  red: '🟥',
  injury: '🚑',
  dribble: '🌀',
  tackle: '🦵',
  interception: '✋',
  pass: '➡️',
  defensive_error: '🤦',
  shootout_start: '🎯',
  shootout_kick: '🎯',
};

export function minuteLabel(e: Pick<MatchEvent, 'minute' | 'extra' | 'type'>): string {
  if (e.type === 'shootout_kick' || e.type === 'shootout_start') return 'RIG';
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
}

export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function shortName(name: string): string {
  const parts = name.split(' ');
  if (parts.length === 1) return name;
  const particles = ['van', 'de', 'del', 'di', 'da', 'der', 'dos', 'ter'];
  let i = parts.length - 1;
  while (i > 0 && particles.includes(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(' ');
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'ora';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return `${Math.floor(s / 86400)} g fa`;
}

export function newBidId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const AVATARS = ['🦁', '🐺', '🦅', '🐉', '🦈', '🐂', '🦊', '🐯', '🐻', '🦄', '👑', '⚡', '🔥', '🚀', '🎩', '🧠'];
