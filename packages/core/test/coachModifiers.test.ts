import { describe, expect, it } from 'vitest';
import { baseMultipliers, CATALOG_COACHES, situationalMultipliers, simulateMatch, strengthView, tacticFitMultiplier, type Coach } from '../src/index';
import { input, STRONG, WEAK } from './fixtures';

const coach = (name: string) => CATALOG_COACHES.find((c) => c.name.includes(name)) as Coach;

describe('CoachModifiers', () => {
  it('coach identity maps to the right multipliers', () => {
    const pep = baseMultipliers(coach('Guardiola'));
    const mou = baseMultipliers(coach('Mourinho'));
    expect(pep.control).toBeGreaterThan(mou.control);
    expect(pep.midfield).toBeGreaterThan(mou.midfield);
    expect(mou.defense).toBeGreaterThan(pep.defense);
    expect(mou.counter).toBeGreaterThan(pep.counter);
  });

  it('lead management: a strong manager locks the game when ahead', () => {
    const mou = situationalMultipliers(coach('Mourinho'), 1, 80);
    const pep = situationalMultipliers(coach('Guardiola'), 1, 80);
    expect(mou.defense).toBeGreaterThan(pep.defense);
    const behind = situationalMultipliers(coach('Klopp'), -1, 80);
    expect(behind.attack).toBeGreaterThan(1);
    expect(behind.defense).toBeLessThan(1);
  });

  it('a coach really changes results over many matches', () => {
    let withCoach = 0;
    let without = 0;
    const N = 300;
    for (let seed = 1; seed <= N; seed++) {
      const a = simulateMatch(input(seed, STRONG, STRONG, { homeCoach: coach('Guardiola') }));
      const b = simulateMatch(input(seed, STRONG, STRONG));
      withCoach += a.homeGoals - a.awayGoals;
      without += b.homeGoals - b.awayGoals;
    }
    expect(withCoach).toBeGreaterThan(without);
  });

  it('tactic fit rewards squads suited to the coach, mitigated by adaptability', () => {
    const catenaccio = coach('Trapattoni');
    expect(tacticFitMultiplier(catenaccio, STRONG)).toBeLessThanOrEqual(1.02);
    expect(tacticFitMultiplier(null, STRONG)).toBeLessThan(1);
    const withCoach = strengthView(WEAK, coach('Ferguson'));
    const noCoach = strengthView(WEAK, null);
    expect(withCoach.overall).toBeGreaterThanOrEqual(noCoach.overall);
  });

  it('all seed coaches have distinct modifier vectors', () => {
    const keys = new Set(CATALOG_COACHES.map((c) => JSON.stringify(c.modifiers)));
    expect(keys.size).toBe(CATALOG_COACHES.length);
    expect(CATALOG_COACHES.length).toBeGreaterThanOrEqual(20);
  });
});
