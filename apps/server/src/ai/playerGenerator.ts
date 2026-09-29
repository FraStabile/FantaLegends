import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import {
  offlineGenerate,
  parseAiGeneration,
  parseGenerationPrompt,
  positionTargets,
  PLAY_STYLES,
  type CatalogItem,
  type GenerationRequest,
} from '@asta/core';

/**
 * AI Player Generator.
 *
 * Claude only proposes structured data (names, prime, attributes). The answer
 * is constrained with Structured Outputs and then re-validated and normalised
 * by the core (`parseAiGeneration`): clamped numbers, overall coherent with the
 * stats, derived rarity/value. The match engine never depends on the LLM.
 * Without credentials, or if the call fails, the offline generator answers the
 * same structured request from the curated database.
 */

// JSON-schema friendly shape (no numeric bounds/regex: they are enforced by the core afterwards)
const statKeys = [
  'pace', 'acceleration', 'shooting', 'passing', 'dribbling', 'ballControl', 'physical', 'stamina', 'strength', 'defending',
  'marking', 'tackling', 'positioning', 'vision', 'composure', 'finishing', 'heading', 'longShots', 'crossing', 'freeKick',
  'penalty', 'aggression', 'diving', 'handling', 'reflexes', 'kicking',
] as const;
const OutputSchema = z.object({
  players: z.array(
    z.object({
      name: z.string(),
      nationality: z.string().describe('FIFA 3-letter code, e.g. ITA, BRA'),
      position: z.enum(['GK', 'DF', 'MF', 'FW']),
      primePeriod: z.string().describe('YYYY-YYYY'),
      historicalClub: z.string(),
      overall: z.number(),
      playStyle: z.enum(PLAY_STYLES as unknown as [string, ...string[]]),
      foot: z.enum(['L', 'R', 'B']),
      heightCm: z.number(),
      weakFoot: z.number(),
      skillMoves: z.number(),
      tags: z.array(z.string()),
      stats: z.object(Object.fromEntries(statKeys.map((k) => [k, z.number()])) as Record<(typeof statKeys)[number], z.ZodNumber>),
    }),
  ),
  coaches: z.array(
    z.object({
      name: z.string(),
      nationality: z.string(),
      primePeriod: z.string(),
      overall: z.number(),
      style: z.string().describe('one short Italian sentence'),
      preferredTactic: z.enum(['possession', 'gegenpress', 'counter', 'catenaccio', 'balanced', 'direct', 'total_football']),
      modifiers: z.object({
        possession: z.number(), passing: z.number(), pressing: z.number(), defense: z.number(), counter: z.number(),
        attack: z.number(), leadManagement: z.number(), deficitManagement: z.number(), adaptability: z.number(), motivation: z.number(),
      }),
      tags: z.array(z.string()),
    }),
  ),
});

const SYSTEM = `You generate football player data for a fantasy auction game ("Asta Legends").
Players are always described in their PRIME (best period). Values must be realistic and differentiated:
- attributes are 1–99; a player's attributes must reflect his real profile (a poacher finishes well and defends poorly, a regista passes and reads the game, a goalkeeper has high diving/handling/reflexes and low outfield stats around 10–30);
- the overall must be coherent with the attributes relevant for the role; world-class primes are 90–97, solid professionals 74–84;
- goalkeepers' outfield attributes are low; outfield players have diving/handling/reflexes/kicking around 8–14;
- coach modifiers are integers in −5…+12 reflecting the coach's identity.
Tags use lowercase words such as legend, modern, world_cup, serie_a, champions, premier, laliga, cult.
Use real footballers when the request is about real football; if the request asks for fictional / themed players (e.g. anime style), invent original names that do not belong to existing copyrighted characters.`;

export interface GenerationOutcome {
  items: CatalogItem[];
  source: 'claude' | 'offline';
  rejected: number;
  request: GenerationRequest;
  note?: string;
}

export class PlayerGenerator {
  private readonly client: Anthropic | null;

  constructor(
    private readonly model: string,
    enabled: boolean,
  ) {
    this.client = enabled && hasAnthropicCredentials() ? new Anthropic() : null;
  }

  get online(): boolean {
    return this.client !== null;
  }

  async generate(prompt: string, salt: string, exclude: Set<string>): Promise<GenerationOutcome> {
    const request = parseGenerationPrompt(prompt);
    if (!this.client) {
      return { items: offlineGenerate(request, exclude), source: 'offline', rejected: 0, request, note: 'Generatore offline: selezione dal database curato' };
    }
    try {
      const targets = positionTargets(request);
      const userPrompt = [
        `Richiesta del Master: "${prompt}"`,
        `Genera esattamente ${request.count} giocatori: ${targets.GK} portieri, ${targets.DF} difensori, ${targets.MF} centrocampisti, ${targets.FW} attaccanti.`,
        request.fromYear ? `Il periodo prime deve iniziare tra il ${request.fromYear} e il ${request.toYear ?? 2026}.` : '',
        request.includeCoaches ? `Genera anche ${request.includeCoaches} allenatori.` : 'Non generare allenatori (coaches: []).',
        exclude.size ? `Evita questi giocatori già presenti: ${[...exclude].slice(0, 80).join(', ')}.` : '',
      ].filter(Boolean).join('\n');

      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: betaZodOutputFormat(OutputSchema) },
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const message = await stream.finalMessage();
      if (message.stop_reason === 'refusal') throw new Error('refusal');
      if (message.stop_reason === 'max_tokens') throw new Error('max_tokens');
      const raw = message.parsed_output ?? JSON.parse(message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(''));
      const { items, rejected } = parseAiGeneration(raw, salt);
      return { items: items.filter((i) => !exclude.has(i.id)), source: 'claude', rejected, request };
    } catch (err) {
      const reason =
        err instanceof Anthropic.RateLimitError ? 'rate limit'
          : err instanceof Anthropic.AuthenticationError ? 'credenziali non valide'
            : err instanceof Anthropic.APIError ? `API ${err.status}`
              : (err as Error).message;
      console.warn('[ai] falling back to offline generator:', reason);
      return { items: offlineGenerate(request, exclude), source: 'offline', rejected: 0, request, note: `Claude non disponibile (${reason}): uso il database curato` };
    }
  }
}

function hasAnthropicCredentials(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}
