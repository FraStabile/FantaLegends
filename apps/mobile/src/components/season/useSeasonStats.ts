import { useEffect, useRef, useState } from 'react';
import type { SeasonStatistics } from '@asta/core';
import { clientFor } from '@/lib/store/session';

/** Season statistics, refetched (debounced) whenever the league version changes. */
export function useSeasonStats(leagueId: string | null | undefined, version: number | undefined, enabled = true) {
  const [state, setState] = useState<{ leagueId: string; stats: SeasonStatistics | null; error: string | null; loading: boolean } | null>(null);
  const lastLeague = useRef<string | null>(null);

  useEffect(() => {
    if (!leagueId || !enabled || version === undefined) return;
    let cancelled = false;
    // first load of a league is immediate, later refreshes are debounced
    const delay = lastLeague.current === leagueId ? 900 : 0;
    lastLeague.current = leagueId;
    const id = setTimeout(async () => {
      setState((s) => (s?.leagueId === leagueId ? { ...s, loading: true } : { leagueId, stats: null, error: null, loading: true }));
      try {
        const stats = await clientFor(leagueId).getStats(leagueId);
        if (!cancelled) setState({ leagueId, stats, error: null, loading: false });
      } catch (e) {
        if (!cancelled) setState((s) => ({ leagueId, stats: s?.leagueId === leagueId ? s.stats : null, error: (e as Error).message, loading: false }));
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [leagueId, version, enabled]);

  const current = state && state.leagueId === leagueId ? state : null;
  return { stats: current?.stats ?? null, loading: current?.loading ?? false, error: current?.error ?? null };
}
