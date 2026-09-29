import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Platform } from 'react-native';
import { LocalClient } from '../net/localClient';
import { RemoteClient, registerGuest, updateRemoteProfile } from '../net/remoteClient';
import type { GameClient } from '../net/types';
import { ONLINE_ENABLED } from '../features';

/** Default backend: explicit build-time URL, else the host that served the web app, else the dev machine. */
function defaultServerUrl(): string {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
  return 'http://localhost:4000';
}

export interface RemoteSession {
  serverUrl: string;
  token: string;
  userId: string;
}

interface SessionState {
  hydrated: boolean;
  displayName: string | null;
  avatar: string;
  localUserId: string;
  serverUrl: string;
  remote: RemoteSession | null;
  activeLeagueId: string | null;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  /** matches whose team talk the user chose to skip (recent ones only) */
  skippedTalks: string[];
  /** league id → challenge id, for the challenges started from the home screen */
  challengeRuns: Record<string, string>;
  setProfile(displayName: string, avatar: string): Promise<void>;
  connectServer(serverUrl: string): Promise<void>;
  disconnectServer(): void;
  setActiveLeague(id: string | null): void;
  setHaptics(on: boolean): void;
  setSound(on: boolean): void;
  skipTalk(matchId: string): void;
  recordChallenge(leagueId: string, challengeId: string): void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      displayName: null,
      avatar: '🦁',
      localUserId: `local-${Math.random().toString(36).slice(2, 10)}`,
      serverUrl: defaultServerUrl(),
      remote: null,
      activeLeagueId: null,
      hapticsEnabled: true,
      soundEnabled: true,
      skippedTalks: [],
      challengeRuns: {},
      async setProfile(displayName, avatar) {
        set({ displayName, avatar });
        const r = get().remote;
        if (r) await updateRemoteProfile(r.serverUrl, r.token, { displayName, avatar });
      },
      async connectServer(serverUrl) {
        const url = serverUrl.trim().replace(/\/$/, '');
        const { displayName, avatar } = get();
        const { token, user } = await registerGuest(url, displayName ?? 'Giocatore', avatar);
        resetClients();
        set({ serverUrl: url, remote: { serverUrl: url, token, userId: user.id } });
      },
      disconnectServer() {
        resetClients();
        set({ remote: null });
      },
      setActiveLeague(id) {
        set({ activeLeagueId: id });
      },
      setHaptics(on) {
        set({ hapticsEnabled: on });
      },
      setSound(on) {
        set({ soundEnabled: on });
      },
      recordChallenge(leagueId, challengeId) {
        set({ challengeRuns: { ...get().challengeRuns, [leagueId]: challengeId } });
      },
      skipTalk(matchId) {
        set({ skippedTalks: [...get().skippedTalks.filter((id) => id !== matchId), matchId].slice(-30) });
      },
    }),
    {
      name: 'asta.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest as never,
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);

// ───────────────────────────── clients

let local: LocalClient | null = null;
let remote: RemoteClient | null = null;

function resetClients() {
  remote?.dispose();
  remote = null;
}

export function localClient(): LocalClient {
  const s = useSession.getState();
  if (!local) {
    local = new LocalClient(s.localUserId, () => {
      const cur = useSession.getState();
      return { displayName: cur.displayName ?? 'Tu', avatar: cur.avatar };
    });
  }
  return local;
}

export function remoteClient(): RemoteClient | null {
  const r = useSession.getState().remote;
  // online play is hidden while in progress: a stored session is simply ignored
  if (!r || !ONLINE_ENABLED) return null;
  if (!remote) remote = new RemoteClient(r.serverUrl, r.token, r.userId);
  return remote;
}

export const isLocalLeague = (leagueId: string) => leagueId.startsWith('local-');

/** Routes a league to the client that owns it (demo leagues live on the device). */
export function clientFor(leagueId: string): GameClient {
  if (isLocalLeague(leagueId)) return localClient();
  const r = remoteClient();
  if (!r) throw new Error('Non sei connesso a un server');
  return r;
}
