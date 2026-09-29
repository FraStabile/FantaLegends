import { CATALOG_PLAYERS, createNarrator, type Coach, type MatchInput, type Player, type Team } from '../src/index';

export const byName = (name: string) => {
  const p = CATALOG_PLAYERS.find((x) => x.name === name);
  if (!p) throw new Error(name);
  return p;
};
const team = (id: string, name = id): Team => ({ id, name, ownerId: id, logo: { emoji: '⚽', color: '#fff' }, credits: 0, roster: [] });

/** Top-tier vs low-tier squads made of real catalog players. */
export const STRONG: Player[] = ['Gianluigi Buffon', 'Paolo Maldini', 'Zinedine Zidane', 'Lionel Messi', 'Ronaldo Nazário'].map(byName);
export const WEAK: Player[] = (() => {
  // lowest "real" tier: the 'bidoni' joke tier would make upsets practically impossible
  const low = (pos: string, n: number) => CATALOG_PLAYERS.filter((p) => p.position === pos && !p.tags.includes('bidoni')).sort((a, b) => a.overall - b.overall).slice(0, n);
  return [...low('GK', 1), ...low('DF', 1), ...low('MF', 1), ...low('FW', 2)];
})();

export function input(seed: number, home: Player[], away: Player[], opts: Partial<MatchInput> & { homeCoach?: Coach | null; awayCoach?: Coach | null } = {}): MatchInput {
  return {
    matchId: `m${seed}`,
    seed,
    homeAdvantage: opts.homeAdvantage ?? false,
    knockout: opts.knockout ?? false,
    home: { team: team('H', 'Francesco FC'), players: home, coach: opts.homeCoach ?? null, form: 0, morale: 0 },
    away: { team: team('A', 'Marco United'), players: away, coach: opts.awayCoach ?? null, form: 0, morale: 0 },
    narrator: createNarrator('epico', seed),
  };
}

