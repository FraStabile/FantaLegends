import type { CommentaryTone, MatchEventType } from '../domain/types';
import { createRng, type Rng } from '../util/rng';
import type { TemplateLibrary } from './templateTypes';
import { TEMPLATES } from './templates';

/** Structured description of an event, turned into text by a Narrator. */
export interface NarrationInput {
  type: MatchEventType;
  detail?: string;
  tails: string[];
  p?: string;
  o?: string;
  t?: string;
  opp?: string;
  score: string;
  minute: number;
  home: string;
  away: string;
}

export type Narrator = (input: NarrationInput) => string;

/**
 * CommentaryEngine: builds a narrator for a tone.
 *
 * It has its own RNG stream (seeded from the match seed) so the choice of words
 * never influences the simulation itself: the same match in two tones has the same
 * result. It avoids repeating the same line within a match.
 */
export function createNarrator(tone: CommentaryTone, seed: number): Narrator {
  const rng = createRng(seed ^ 0x5eed);
  const lib = TEMPLATES[tone] ?? TEMPLATES.classico;
  const used = new Set<string>();

  return (input) => {
    const keys = candidateKeys(input);
    // a line that names a secondary actor who is not there would read "un compagno…": avoid it
    const fits = (line: string) => input.o !== undefined || !line.includes('{o}');
    const main = pickLine(lib, keys, rng, used, fits) ?? pickLine(lib, keys, rng, used, () => true) ?? '';
    const tails = input.tails
      .map((t) => pickLine(lib, [`tail:${t}`], rng, used, fits))
      .filter((l): l is string => !!l)
      .slice(0, 2);
    return fill([main, ...tails].join(' '), input);
  };
}

function candidateKeys(input: NarrationInput): string[] {
  if (input.type === 'fulltime') return [`fulltime:${input.detail ?? 'draw'}`];
  const keys: string[] = [];
  if (input.detail) keys.push(`${input.type}:${input.detail}`);
  keys.push(input.type);
  return keys;
}

function pickLine(lib: TemplateLibrary, keys: string[], rng: Rng, used: Set<string>, fits: (line: string) => boolean): string | null {
  for (const key of keys) {
    const options = lib[key]?.filter(fits);
    if (!options?.length) continue;
    const fresh = options.filter((o) => !used.has(o));
    const line = rng.pick(fresh.length ? fresh : options);
    used.add(line);
    return line;
  }
  return null;
}

function fill(template: string, i: NarrationInput): string {
  const values: Record<string, string> = {
    p: i.p ?? i.t ?? '',
    o: i.o ?? 'un compagno',
    t: i.t ?? '',
    opp: i.opp ?? '',
    score: i.score,
    min: String(i.minute),
    home: i.home,
    away: i.away,
  };
  return template.replace(/\{(p|o|t|opp|score|min|home|away)\}/g, (_, k: string) => values[k]).replace(/\s+/g, ' ').trim();
}
