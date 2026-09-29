import { describe, expect, it } from 'vitest';
import { CATALOG_PLAYERS, createCustomPlayer, derivePlayerStats, positionalOverall, zoneValues, baseValueFor, POOL_SETS, buildPool, DEFAULT_CONFIG, createRng, Catalog } from '../src/index';

describe('PlayerRating & seed data', () => {
  it('has enough realistic seed data per role', () => {
    const count = (pos: string) => CATALOG_PLAYERS.filter((p) => p.position === pos).length;
    expect(count('GK')).toBeGreaterThanOrEqual(30);
    expect(count('DF')).toBeGreaterThanOrEqual(50);
    expect(count('MF')).toBeGreaterThanOrEqual(50);
    expect(count('FW')).toBeGreaterThanOrEqual(50);
    const ids = CATALOG_PLAYERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declared overalls are coherent with the individual stats', () => {
    const diffs = CATALOG_PLAYERS.map((p) => positionalOverall(p.position, p.stats) - p.overall);
    const meanAbs = diffs.reduce((s, d) => s + Math.abs(d), 0) / diffs.length;
    expect(meanAbs).toBeLessThan(3);
    expect(Math.max(...diffs.map(Math.abs))).toBeLessThanOrEqual(10);
  });

  it('stats are not a copy of the overall: role shapes them', () => {
    const messi = CATALOG_PLAYERS.find((p) => p.name === 'Lionel Messi')!;
    const buffon = CATALOG_PLAYERS.find((p) => p.name === 'Gianluigi Buffon')!;
    expect(messi.stats.dribbling).toBeGreaterThan(messi.stats.defending + 40);
    expect(buffon.stats.reflexes).toBeGreaterThan(buffon.stats.finishing + 50);
    expect(zoneValues(messi.stats).attack).toBeGreaterThan(zoneValues(buffon.stats).attack);
    expect(zoneValues(buffon.stats).goalkeeping).toBeGreaterThan(85);
  });

  it('play style shapes derived stats deterministically', () => {
    const base = { n: 'Test Player', nat: 'ITA', pos: 'FW' as const, prime: '2020-2022', club: 'X', era: '2020s' as const, foot: 'R' as const, h: 185, ovr: 85, f: [80, 85, 70, 80, 30, 75] as [number, number, number, number, number, number], tags: [] };
    const poacher = derivePlayerStats({ ...base, style: 'poacher' });
    const target = derivePlayerStats({ ...base, style: 'target_man' });
    expect(poacher.finishing).toBeGreaterThan(target.finishing);
    expect(target.heading).toBeGreaterThan(poacher.heading);
    expect(derivePlayerStats({ ...base, style: 'poacher' })).toEqual(poacher);
  });

  it('auction base value is convex in the overall', () => {
    expect(baseValueFor(97)).toBeGreaterThan(baseValueFor(90) * 1.3);
    expect(baseValueFor(75)).toBeLessThan(5);
  });

  it('custom players get a role-shaped stat sheet', () => {
    const cugino = createCustomPlayer({ name: 'Gianni Il Cugino', position: 'FW', overall: 72 });
    expect(cugino.source).toBe('custom');
    expect(cugino.stats.finishing).toBeGreaterThan(cugino.stats.defending);
    expect(Math.abs(positionalOverall('FW', cugino.stats) - 72)).toBeLessThanOrEqual(6);
  });

  it('thematic sets and presets filter the pool', () => {
    expect(POOL_SETS.find((s) => s.id === 'serie_a')).toBeTruthy();
    const rng = createRng(1);
    const pool = buildPool({ ...DEFAULT_CONFIG, poolPreset: 'LEGENDS' }, [], 6, rng);
    const catalog = new Catalog();
    expect(pool.every((id) => catalog.get(id).tags.includes('legend'))).toBe(true);
    const modern = buildPool({ ...DEFAULT_CONFIG, poolPreset: 'MODERN' }, [], 4, rng);
    expect(modern.every((id) => catalog.get(id).tags.includes('modern'))).toBe(true);
    expect(() => buildPool({ ...DEFAULT_CONFIG, poolPreset: 'CUSTOM' }, [], 4, rng)).toThrow(expect.objectContaining({ code: 'POOL_TOO_SMALL' }));
  });
});
