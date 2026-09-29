import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localClient, remoteClient, useSession } from '../store/session';
import type { LeagueSummary } from '../net/types';

export interface MyLeague extends LeagueSummary {
  local: boolean;
}

/** Leagues of the user, online (server) and demo (on device), most recent first. */
export function useMyLeagues() {
  const remote = useSession((s) => s.remote);
  const [leagues, setLeagues] = useState<MyLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const out: MyLeague[] = [];
    const local = await localClient().listLeagues().catch(() => []);
    out.push(...local.map((l) => ({ ...l, local: true })));
    const r = remoteClient();
    if (r) {
      try {
        out.push(...(await r.listLeagues()).map((l) => ({ ...l, local: false })));
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setLeagues(out.sort((a, b) => b.updatedAt - a.updatedAt));
    setLoading(false);
  }, [remote]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { leagues, loading, error, refresh };
}
