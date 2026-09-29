import type { Award, League, MatchResult } from '../domain/types';
import { Catalog } from '../catalog/catalog';
import { computeStatistics } from './statistics';
import { computeStandings } from '../tournament/standings';

/**
 * End-of-tournament awards. Everything is derived from match results and the
 * auction ledger: no award is hand-picked.
 */
const credits = (n: number) => `${n} ${n === 1 ? 'credito' : 'crediti'}`;

export function computeAwards(league: League, results: MatchResult[]): Award[] {
  const t = league.tournament;
  if (!t) return [];
  const catalog = new Catalog(league.customItems);
  const stats = computeStatistics(results, t.matches);
  const teamName = (id: string | null) => league.teams.find((x) => x.id === id)?.name ?? '—';
  const itemName = (id: string) => catalog.find(id)?.name ?? id;
  const awards: Award[] = [];
  const minApps = Math.max(1, Math.floor(Math.max(0, ...stats.players.map((p) => p.apps)) / 2));

  if (t.championTeamId) {
    awards.push({ key: 'champion', title: 'Campione', teamId: t.championTeamId, itemId: null, value: teamName(t.championTeamId), description: `${teamName(t.championTeamId)} alza il trofeo!` });
  }

  const best = <T>(arr: T[], score: (x: T) => number) => arr.reduce<T | null>((b, x) => (b === null || score(x) > score(b) ? x : b), null);

  const scorer = best(stats.players.filter((p) => p.goals > 0), (p) => p.goals * 100 + p.avgRating);
  if (scorer) awards.push({ key: 'top_scorer', title: 'Capocannoniere', teamId: scorer.teamId, itemId: scorer.playerId, value: `${scorer.goals} gol`, description: `${itemName(scorer.playerId)} (${teamName(scorer.teamId)})` });

  const assist = best(stats.players.filter((p) => p.assists > 0), (p) => p.assists * 100 + p.avgRating);
  if (assist) awards.push({ key: 'top_assist', title: 'Miglior assistman', teamId: assist.teamId, itemId: assist.playerId, value: `${assist.assists} assist`, description: `${itemName(assist.playerId)} (${teamName(assist.teamId)})` });

  const keepers = stats.players.filter((p) => catalog.find(p.playerId)?.kind === 'player' && catalog.player(p.playerId).position === 'GK' && p.apps >= minApps);
  const gk = best(keepers, (p) => p.cleanSheets * 2 + p.avgRating + p.saves / Math.max(1, p.apps) * 0.3);
  if (gk) awards.push({ key: 'best_goalkeeper', title: 'Miglior portiere', teamId: gk.teamId, itemId: gk.playerId, value: `${gk.cleanSheets} clean sheet · ${gk.avgRating.toFixed(2)}`, description: `${itemName(gk.playerId)} (${teamName(gk.teamId)})` });

  const mvp = best(stats.players.filter((p) => p.apps >= minApps), (p) => p.avgRating + p.mvps * 0.05);
  if (mvp) awards.push({ key: 'mvp', title: 'MVP del torneo', teamId: mvp.teamId, itemId: mvp.playerId, value: `media ${mvp.avgRating.toFixed(2)}`, description: `${itemName(mvp.playerId)} (${teamName(mvp.teamId)}), ${mvp.mvps} volte migliore in campo` });

  // best coach: points per game relative to the squad's pre-season strength rank
  const standings = computeStandings(league.teams.map((x) => x.id), t.matches, t.groups);
  const coachOf = (teamId: string) => league.teams.find((x) => x.id === teamId)?.roster.find((r) => r.slot === 'COACH')?.itemId ?? null;
  const coachCandidates = stats.teams
    .map((ts) => ({ ts, coachId: coachOf(ts.teamId), row: standings.find((r) => r.teamId === ts.teamId) }))
    .filter((x) => x.coachId);
  const coach = best(coachCandidates, (x) => (x.ts.won * 3 + x.ts.drawn) / Math.max(1, x.ts.played) + (x.ts.teamId === t.championTeamId ? 0.5 : 0) + (x.row ? -standings.indexOf(x.row) * 0.05 : 0));
  if (coach) awards.push({ key: 'best_coach', title: 'Miglior allenatore', teamId: coach.ts.teamId, itemId: coach.coachId, value: `${coach.ts.won}V ${coach.ts.drawn}N ${coach.ts.lost}P`, description: `${itemName(coach.coachId!)} (${teamName(coach.ts.teamId)})` });

  // goal & save of the tournament from match highlights
  const bestGoal = best(results.filter((r) => r.highlights.bestGoal), (r) => r.highlights.bestGoal!.score);
  if (bestGoal?.highlights.bestGoal) {
    const g = bestGoal.highlights.bestGoal;
    const ev = bestGoal.events.find((e) => e.seq === g.seq);
    awards.push({ key: 'goal_of_tournament', title: 'Gol del torneo', teamId: g.teamId, itemId: g.playerId, value: ev ? `${ev.minute}'` : '', description: ev?.commentary ?? itemName(g.playerId) });
  }
  const bestSave = best(results.filter((r) => r.highlights.bestSave), (r) => r.highlights.bestSave!.score);
  if (bestSave?.highlights.bestSave) {
    const s = bestSave.highlights.bestSave;
    const ev = bestSave.events.find((e) => e.seq === s.seq);
    awards.push({ key: 'save_of_tournament', title: 'Parata del torneo', teamId: s.teamId, itemId: s.playerId, value: ev ? `${ev.minute}'` : '', description: ev?.commentary ?? itemName(s.playerId) });
  }

  // auction awards: value for money = (avg rating − 5.5) per credit, weighted by appearances
  const purchases = league.auction.results.filter((r) => r.teamId && r.kind === 'player' && !r.autoAssigned);
  const perf = new Map(stats.players.map((p) => [p.playerId, p]));
  const value = purchases
    .map((r) => ({ r, p: perf.get(r.itemId) }))
    .filter((x) => x.p && x.p.apps > 0)
    .map((x) => ({ ...x, impact: (x.p!.avgRating - 5.5) * x.p!.apps + x.p!.goals * 0.5 + x.p!.assists * 0.3 }));
  const bestBuy = best(value, (x) => x.impact / Math.max(1, x.r.price) + x.impact * 0.02);
  if (bestBuy) awards.push({ key: 'best_buy', title: 'Miglior acquisto', teamId: bestBuy.r.teamId, itemId: bestBuy.r.itemId, value: credits(bestBuy.r.price), description: `${itemName(bestBuy.r.itemId)}: media ${bestBuy.p!.avgRating.toFixed(2)}` });
  const worstBuy = best(value.filter((x) => x.r.price >= 5), (x) => x.r.price / Math.max(0.5, x.impact + 3));
  if (worstBuy) awards.push({ key: 'worst_buy', title: 'Peggior acquisto', teamId: worstBuy.r.teamId, itemId: worstBuy.r.itemId, value: credits(worstBuy.r.price), description: `${itemName(worstBuy.r.itemId)}: media ${worstBuy.p!.avgRating.toFixed(2)}. Ahia.` });

  // bargain of the auction: highest overall per credit spent
  const bargain = best(league.auction.results.filter((r) => r.teamId && !r.autoAssigned), (r) => catalog.get(r.itemId).overall / Math.max(1, r.price));
  if (bargain) awards.push({ key: 'bargain', title: "Affare dell'asta", teamId: bargain.teamId, itemId: bargain.itemId, value: credits(bargain.price), description: `${itemName(bargain.itemId)} (${catalog.get(bargain.itemId).overall} OVR) a prezzo di saldo` });

  const priciest = best(league.auction.results.filter((r) => r.teamId), (r) => r.price);
  if (priciest) awards.push({ key: 'most_expensive', title: 'Bid più costoso', teamId: priciest.teamId, itemId: priciest.itemId, value: credits(priciest.price), description: `${itemName(priciest.itemId)} → ${teamName(priciest.teamId)}` });

  return awards;
}
