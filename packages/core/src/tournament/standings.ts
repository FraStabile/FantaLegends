import type { MatchSummary, StandingRow } from '../domain/types';

function emptyRow(teamId: string, group: string | null): StandingRow {
  return { teamId, group, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, form: [] };
}

/**
 * League table from finished league/group matches.
 * Ordering: points, goal difference, goals scored, head-to-head points, then name order given.
 */
export function computeStandings(teamIds: string[], matches: MatchSummary[], groups: Record<string, string[]> | null = null): StandingRow[] {
  const groupOf = (id: string) => (groups ? Object.entries(groups).find(([, ids]) => ids.includes(id))?.[0] ?? null : null);
  const rows = new Map(teamIds.map((id) => [id, emptyRow(id, groupOf(id))]));
  const counted = matches
    .filter((m) => m.status === 'finished' && (m.stage === 'league' || m.stage === 'group'))
    .sort((a, b) => a.round - b.round);

  for (const m of counted) {
    const h = rows.get(m.homeTeamId);
    const a = rows.get(m.awayTeamId);
    if (!h || !a) continue;
    const hg = m.homeGoals ?? 0;
    const ag = m.awayGoals ?? 0;
    h.played++; a.played++;
    h.goalsFor += hg; h.goalsAgainst += ag;
    a.goalsFor += ag; a.goalsAgainst += hg;
    if (hg > ag) { h.won++; a.lost++; h.points += 3; h.form.push('W'); a.form.push('L'); }
    else if (hg < ag) { a.won++; h.lost++; a.points += 3; a.form.push('W'); h.form.push('L'); }
    else { h.drawn++; a.drawn++; h.points++; a.points++; h.form.push('D'); a.form.push('D'); }
  }

  const all = [...rows.values()];
  for (const r of all) {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
    r.form = r.form.slice(-5);
  }

  const h2h = (x: string, y: string) => {
    let px = 0, py = 0;
    for (const m of counted) {
      if (!((m.homeTeamId === x && m.awayTeamId === y) || (m.homeTeamId === y && m.awayTeamId === x))) continue;
      const xg = m.homeTeamId === x ? m.homeGoals! : m.awayGoals!;
      const yg = m.homeTeamId === x ? m.awayGoals! : m.homeGoals!;
      if (xg > yg) px += 3; else if (yg > xg) py += 3; else { px++; py++; }
    }
    return py - px;
  };
  const order = new Map(teamIds.map((id, i) => [id, i]));
  return all.sort(
    (a, b) =>
      (a.group ?? '').localeCompare(b.group ?? '') ||
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      h2h(a.teamId, b.teamId) ||
      order.get(a.teamId)! - order.get(b.teamId)!,
  );
}

/** Numeric form in −1…+1 from the last results (W = +1, D = 0, L = −1). */
export function formScore(row: StandingRow | undefined): number {
  if (!row || row.form.length === 0) return 0;
  return row.form.reduce((s, f) => s + (f === 'W' ? 1 : f === 'L' ? -1 : 0), 0) / row.form.length;
}
