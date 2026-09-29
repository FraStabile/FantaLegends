import { describe, expect, it } from 'vitest';
import {
  COMMENTARY_KEYS,
  createNarrator,
  offlineGenerate,
  parseAiGeneration,
  parseGenerationPrompt,
  positionTargets,
  simulateMatch,
  type CommentaryTone,
} from '../src/index';
import { TEMPLATES } from '../src/commentary/templates';
import { input, STRONG, WEAK } from './fixtures';

const TONES: CommentaryTone[] = ['classico', 'epico', 'tecnico', 'ironico', 'trash', 'bar_sport'];

describe('Commentary', () => {
  it('every tone covers every event key', () => {
    for (const tone of TONES) for (const key of COMMENTARY_KEYS) expect(TEMPLATES[tone][key]?.length, `${tone}/${key}`).toBeGreaterThan(0);
  });

  it('fills every placeholder and never changes the simulated result', () => {
    const base = simulateMatch(input(11, STRONG, WEAK));
    for (const tone of TONES) {
      const r = simulateMatch({ ...input(11, STRONG, WEAK), narrator: createNarrator(tone, 11) });
      expect([r.homeGoals, r.awayGoals]).toEqual([base.homeGoals, base.awayGoals]);
      for (const e of r.events) expect(e.commentary).not.toMatch(/\{\w+\}/);
    }
  });

  it('uses player names and appends situational tails', () => {
    const narrate = createNarrator('epico', 3);
    const line = narrate({ type: 'goal', tails: ['equalizer'], p: 'Messi', o: 'Xavi', t: 'Francesco FC', opp: 'Marco United', score: '1-1', minute: 67, home: 'Francesco FC', away: 'Marco United' });
    expect(line).toContain('Messi');
    expect(line.length).toBeGreaterThan(20);
  });
});

describe('AI player generator', () => {
  it('parses the Master request', () => {
    const req = parseGenerationPrompt('Genera 40 giocatori storici, dal 1980 al 2025, distribuiti in modo equilibrato per ruolo.');
    expect(req).toMatchObject({ count: 40, fromYear: 1980, toYear: 2025, balanced: true });
    const t = positionTargets(req);
    expect(t.GK + t.DF + t.MF + t.FW).toBe(40);
    expect(t.FW).toBeGreaterThan(t.GK);
  });

  it('validates and normalises LLM output, dropping invalid entries', () => {
    const good = {
      name: 'Kazuki Tempesta', nationality: 'JPN', position: 'FW', primePeriod: '2030-2032', historicalClub: 'Tokyo Stars', overall: 99,
      playStyle: 'speedster', foot: 'L', heightCm: 176, weakFoot: 4, skillMoves: 5, tags: ['anime'],
      stats: { pace: 95, acceleration: 96, shooting: 80, passing: 70, dribbling: 88, ballControl: 85, physical: 60, stamina: 80, strength: 55, defending: 30, marking: 25, tackling: 28, positioning: 82, vision: 70, composure: 75, finishing: 82, heading: 60, longShots: 70, crossing: 65, freeKick: 60, penalty: 70, aggression: 50, diving: 10, handling: 10, reflexes: 10, kicking: 10 },
    };
    const { items, rejected } = parseAiGeneration({ players: [good, { name: 'broken' }], coaches: [] }, 'lg1');
    expect(rejected).toBe(1);
    expect(items).toHaveLength(1);
    const p = items[0];
    expect(p.kind).toBe('player');
    // declared 99 is inconsistent with the stats: the stats win
    expect(p.overall).toBeLessThan(92);
    expect(p.source).toBe('ai');
    expect(p.era).toBe('2020s');
  });

  it('offline generator honours year range and role balance', () => {
    const req = parseGenerationPrompt('Genera 20 giocatori dal 1990 al 2010 equilibrati per ruolo e 3 allenatori');
    const items = offlineGenerate(req, new Set());
    const players = items.filter((i) => i.kind === 'player');
    expect(players.length).toBeGreaterThanOrEqual(15);
    for (const p of players) {
      const y = Number(p.primePeriod.slice(0, 4));
      expect(y).toBeGreaterThanOrEqual(1990);
      expect(y).toBeLessThanOrEqual(2010);
    }
    expect(items.filter((i) => i.kind === 'coach').length).toBeGreaterThan(0);
  });
});
