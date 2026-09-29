import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Catalog, type DomainEvent, type LeagueView } from '@asta/core';
import { clientFor } from '../store/session';
import type { CommandMap, CommandName, ConnectionStatus } from '../net/types';
import { toast } from '../store/toasts';

export interface LeagueHandle {
  view: LeagueView | null;
  error: string | null;
  catalog: Catalog;
  me: LeagueView['members'][number] | null;
  myTeam: LeagueView['teams'][number] | null;
  isMaster: boolean;
  serverNow: () => number;
  /** fire a command; errors are shown as toasts and re-thrown */
  run: <K extends CommandName>(name: K, payload: CommandMap[K]) => Promise<unknown>;
}

/** Live subscription to a league: re-renders on every authoritative snapshot. */
export function useLeague(leagueId: string | null | undefined, onEvents?: (events: DomainEvent[]) => void): LeagueHandle {
  const [view, setView] = useState<LeagueView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventsRef = useRef(onEvents);
  eventsRef.current = onEvents;

  useEffect(() => {
    if (!leagueId) return;
    setView(null);
    setError(null);
    try {
      return clientFor(leagueId).subscribe(leagueId, {
        onState: (v) => setView(v),
        onEvents: (e) => eventsRef.current?.(e),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [leagueId]);

  const customKey = view?.customItems.length ?? 0;
  const catalog = useMemo(() => new Catalog(view?.customItems ?? []), [customKey, view?.id]);
  const me = view?.members.find((m) => m.userId === view.viewerId) ?? null;
  const myTeam = view?.teams.find((t) => t.id === me?.teamId) ?? null;

  const run = useCallback(
    async <K extends CommandName>(name: K, payload: CommandMap[K]) => {
      if (!leagueId) return;
      try {
        return await clientFor(leagueId).command(leagueId, name, payload);
      } catch (e) {
        toast.error((e as Error).message);
        throw e;
      }
    },
    [leagueId],
  );

  const serverNow = useCallback(() => (leagueId ? clientFor(leagueId).serverNow() : Date.now()), [leagueId]);

  return { view, error, catalog, me, myTeam, isMaster: !!me?.isMaster, serverNow, run };
}

export function useConnection(leagueId: string | null | undefined): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  useEffect(() => {
    if (!leagueId) return;
    try {
      return clientFor(leagueId).onConnection(setStatus);
    } catch {
      setStatus('offline');
    }
  }, [leagueId]);
  return status;
}

/** Re-render at a fixed interval (countdowns). */
export function useTicker(intervalMs: number, active = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return tick;
}
