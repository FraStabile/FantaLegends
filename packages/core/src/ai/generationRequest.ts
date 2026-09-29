import type { CatalogItem, Position } from '../domain/types';
import { CATALOG_COACHES, CATALOG_PLAYERS } from '../catalog/catalog';
import { createRng, hashString } from '../util/rng';

/**
 * Parsing of the Master's natural-language request, e.g.
 * "Genera 40 giocatori storici, dal 1980 al 2025, distribuiti in modo equilibrato per ruolo."
 * The structured request drives both the LLM prompt and the offline generator.
 */
export interface GenerationRequest {
  prompt: string;
  count: number;
  fromYear: number | null;
  toYear: number | null;
  balanced: boolean;
  includeCoaches: number;
  positions: Position[] | null;
}

export function parseGenerationPrompt(prompt: string, maxCount = 60): GenerationRequest {
  const text = prompt.toLowerCase();
  const countMatch = text.match(/(\d{1,3})\s*(giocator|calciator|player|element|nom)/) ?? text.match(/genera\s+(\d{1,3})/);
  const count = Math.max(1, Math.min(maxCount, countMatch ? Number(countMatch[1]) : 20));
  const years = [...text.matchAll(/(19[5-9]\d|20[0-4]\d)/g)].map((m) => Number(m[1]));
  const coachMatch = text.match(/(\d{1,2})\s*allenator/);
  const positions: Position[] = [];
  if (/portier/.test(text)) positions.push('GK');
  if (/difensor/.test(text)) positions.push('DF');
  if (/centrocampist/.test(text)) positions.push('MF');
  if (/attaccant|punt/.test(text)) positions.push('FW');
  return {
    prompt,
    count,
    fromYear: years.length ? Math.min(...years) : null,
    toYear: years.length > 1 ? Math.max(...years) : null,
    balanced: /equilibr|bilanciat|balanced|per ruolo/.test(text) || positions.length === 0,
    includeCoaches: coachMatch ? Math.min(20, Number(coachMatch[1])) : /allenator/.test(text) ? 4 : 0,
    positions: positions.length ? positions : null,
  };
}

/** Share of each role for a balanced squad pool (roughly 1-1-1-2 plus depth). */
export const BALANCED_SHARE: Record<Position, number> = { GK: 0.15, DF: 0.28, MF: 0.27, FW: 0.3 };

export function positionTargets(req: GenerationRequest): Record<Position, number> {
  const roles = req.positions ?? (['GK', 'DF', 'MF', 'FW'] as Position[]);
  const share = roles.reduce((s, r) => s + BALANCED_SHARE[r], 0);
  const out: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  let assigned = 0;
  for (const r of roles) {
    out[r] = Math.floor((req.count * BALANCED_SHARE[r]) / share);
    assigned += out[r];
  }
  for (let i = 0; assigned < req.count; i++, assigned++) out[roles[i % roles.length]]++;
  return out;
}

function primeStart(prime: string): number {
  return Number(prime.slice(0, 4));
}

/**
 * Offline generator: used when no LLM key is configured (or the call fails).
 * It answers the same structured request by sampling the curated database,
 * respecting year range and role balance, so the feature always works.
 */
export function offlineGenerate(req: GenerationRequest, exclude: Set<string>): CatalogItem[] {
  const rng = createRng(hashString(req.prompt + req.count));
  const inRange = (prime: string) => {
    const y = primeStart(prime);
    return (req.fromYear === null || y >= req.fromYear) && (req.toYear === null || y <= req.toYear);
  };
  const targets = positionTargets(req);
  const out: CatalogItem[] = [];
  for (const pos of Object.keys(targets) as Position[]) {
    const candidates = CATALOG_PLAYERS.filter((p) => p.position === pos && inRange(p.primePeriod) && !exclude.has(p.id));
    out.push(...rng.shuffle(candidates).slice(0, targets[pos]));
  }
  if (req.includeCoaches) {
    out.push(...rng.shuffle(CATALOG_COACHES.filter((c) => inRange(c.primePeriod) && !exclude.has(c.id))).slice(0, req.includeCoaches));
  }
  return out;
}
