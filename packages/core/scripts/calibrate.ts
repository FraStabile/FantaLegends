import { CATALOG_PLAYERS, CATALOG_COACHES } from '../src/catalog/catalog';
import { simulateMatch } from '../src/match/matchEngine';
import { createNarrator } from '../src/commentary/narrator';
import { createRng } from '../src/util/rng';
import type { Player, Team } from '../src/domain/types';

const rng = createRng(42);
const by = (pos: string) => CATALOG_PLAYERS.filter((p) => p.position === pos);
function squad(minOvr: number, maxOvr: number): Player[] {
  const f = (pos: string, n: number) => rng.shuffle(by(pos).filter((p) => p.overall >= minOvr && p.overall <= maxOvr)).slice(0, n);
  return [...f('GK', 1), ...f('DF', 1), ...f('MF', 1), ...f('FW', 2)];
}
const team = (id: string): Team => ({ id, name: id, ownerId: id, logo: { emoji: '⚽', color: '#fff' }, credits: 0, roster: [] });
let goals = 0, shots = 0, draws = 0, n = 0, strongWins = 0, weakWins = 0, sot = 0, fouls = 0, yellows = 0, reds = 0, pens = 0, corners = 0, events = 0;
const scoreDist: Record<string, number> = {};
for (let i = 0; i < 1000; i++) {
  const strong = i % 2 === 0;
  const hp = strong ? squad(88, 99) : squad(74, 99);
  const ap = strong ? squad(74, 84) : squad(74, 99);
  const r = simulateMatch({
    matchId: 'm' + i, seed: i * 7919, homeAdvantage: true, knockout: false,
    home: { team: team('H'), players: hp, coach: rng.pick(CATALOG_COACHES), form: 0, morale: 0 },
    away: { team: team('A'), players: ap, coach: rng.pick(CATALOG_COACHES), form: 0, morale: 0 },
    narrator: createNarrator('epico', i),
  });
  n++; goals += r.homeGoals + r.awayGoals; shots += r.homeStats.shots + r.awayStats.shots;
  sot += r.homeStats.shotsOnTarget + r.awayStats.shotsOnTarget; fouls += r.homeStats.fouls + r.awayStats.fouls;
  yellows += r.homeStats.yellows + r.awayStats.yellows; reds += r.homeStats.reds + r.awayStats.reds; corners += r.homeStats.corners + r.awayStats.corners;
  pens += r.events.filter(e => e.type === 'penalty_awarded').length; events += r.events.length;
  if (r.homeGoals === r.awayGoals) draws++;
  if (strong) { if (r.homeGoals > r.awayGoals) strongWins++; if (r.homeGoals < r.awayGoals) weakWins++; }
  const k = `${Math.max(r.homeGoals, r.awayGoals)}-${Math.min(r.homeGoals, r.awayGoals)}`; scoreDist[k] = (scoreDist[k] ?? 0) + 1;
}
console.log({ goalsPerMatch: goals / n, shotsPerTeam: shots / n / 2, sotPerTeam: sot / n / 2, drawRate: draws / n, strongWinRate: strongWins / 500, weakWinRate: weakWins / 500, foulsPerTeam: fouls / n / 2, yellowsPerMatch: yellows / n, redsPerMatch: reds / n, pensPerMatch: pens / n, cornersPerTeam: corners / n / 2, eventsPerMatch: events / n });
console.log(Object.entries(scoreDist).sort((a, b) => b[1] - a[1]).slice(0, 12));
