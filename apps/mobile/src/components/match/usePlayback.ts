import { useEffect, useRef, useState } from 'react';
import type { MatchView } from '@asta/core';

export type Speed = 1 | 2 | 4 | 10;

export interface Playback {
  /** timeline position (MatchEvent.t units) the user is watching */
  pos: number;
  playing: boolean;
  speed: Speed;
  /** true while glued to the shared live edge */
  atLive: boolean;
  liveEdge: number | null;
  setPlaying(p: boolean): void;
  setSpeed(s: Speed): void;
  goLive(): void;
  restart(): void;
  skipToEnd(): void;
}

/**
 * Client-side playback of a match timeline.
 *
 * Live: the server reveals events on a shared clock (kickoff + liveMs). The user
 * can pause, then catch up faster, but never beyond the live edge (no spoilers).
 * Finished: free replay at 1×–10×.
 * `free` (single-player demo): the client has the whole timeline, so a live match
 * starts at the live position but can then be watched at any speed.
 */
export function usePlayback(match: MatchView | null, serverNow: () => number, free = false): Playback {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const [atLive, setAtLive] = useState(true);
  const initialised = useRef<string | null>(null);
  const ref = useRef({ match, playing, speed, atLive, free });
  ref.current = { match, playing, speed, atLive, free };

  /** shared live clock position, used to join a live match where everybody is */
  const sharedEdgeOf = (m: MatchView | null): number | null => {
    if (!m || m.summary.status !== 'live' || m.summary.kickoffAt === null) return null;
    return Math.max(0, Math.min(m.totalTime, ((serverNow() - m.summary.kickoffAt) / m.liveMs) * m.totalTime));
  };
  /** the position playback may not pass (null = no limit) */
  const liveEdgeOf = (m: MatchView | null): number | null => (ref.current.free ? null : sharedEdgeOf(m));

  // first load: live → join the live edge; finished → start from the end (recap), replay on demand
  useEffect(() => {
    if (!match || initialised.current === match.summary.id) return;
    initialised.current = match.summary.id;
    if (match.summary.status === 'finished') {
      setPos(match.totalTime);
      setPlaying(false);
      setAtLive(false);
    } else {
      setPos(sharedEdgeOf(match) ?? 0);
      setAtLive(!free);
    }
  }, [match]);

  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      const { match: m, playing: p, speed: sp, atLive: live } = ref.current;
      if (!m || m.totalTime <= 0) return;
      const edge = liveEdgeOf(m);
      setPos((current) => {
        if (edge !== null && live && p) return edge;
        if (!p) return current;
        const next = current + (dt / m.liveMs) * m.totalTime * sp;
        if (edge !== null && next >= edge) {
          setAtLive(true);
          return edge;
        }
        return Math.min(m.totalTime, next);
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const liveEdge = liveEdgeOf(match);
  return {
    pos,
    playing,
    speed,
    atLive: liveEdge !== null && atLive,
    liveEdge,
    setPlaying: (p) => {
      setPlaying(p);
      if (!p) setAtLive(false);
    },
    setSpeed: (s) => {
      setSpeed(s);
      if (liveEdge !== null && s !== 1) setAtLive(false);
    },
    goLive: () => {
      setAtLive(true);
      setPlaying(true);
      setSpeed(1);
    },
    restart: () => {
      setPos(0);
      setPlaying(true);
      setAtLive(false);
    },
    skipToEnd: () => {
      if (!match) return;
      if (liveEdge !== null) {
        setAtLive(true);
        setPlaying(true);
      } else {
        setPos(match.totalTime);
        setPlaying(false);
      }
    },
  };
}

/** Elapsed match clock "mm:ss" from a timeline position. */
export function matchClock(match: MatchView, pos: number): { label: string; phase: 'pre' | 'first' | 'break' | 'second' | 'end' } {
  const ht = match.events.find((e) => e.type === 'halftime');
  const ft = match.events.find((e) => e.type === 'fulltime');
  if (pos <= 0) return { label: '00:00', phase: 'pre' };
  if (ft && pos >= ft.t) return { label: 'FINALE', phase: 'end' };
  const fmt = (min: number) => `${String(Math.floor(min)).padStart(2, '0')}:${String(Math.floor((min % 1) * 60)).padStart(2, '0')}`;
  if (!ht || pos < ht.t) return { label: fmt(pos), phase: 'first' };
  if (pos < ht.t + 2) return { label: 'INTERVALLO', phase: 'break' };
  return { label: fmt(45 + (pos - ht.t - 2)), phase: 'second' };
}
