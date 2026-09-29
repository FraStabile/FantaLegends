import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AwardKey, CoachModifiers, MatchSummary, StandingRow, TeamView } from '@asta/core';
import { C, R, S, T } from '@/lib/theme';
import { TeamBadge } from '@/components/ui';

export const AWARD_EMOJI: Record<AwardKey, string> = {
  champion: '🏆',
  top_scorer: '👟',
  top_assist: '🎯',
  best_goalkeeper: '🧤',
  mvp: '⭐',
  best_coach: '📋',
  goal_of_tournament: '💥',
  save_of_tournament: '🦸',
  best_buy: '💎',
  worst_buy: '🤡',
  bargain: '🤑',
  most_expensive: '💸',
};

/** Italian labels of the coach modifiers. */
export const MODIFIER_IT: Record<keyof CoachModifiers, string> = {
  possession: 'Possesso',
  passing: 'Passaggi',
  pressing: 'Pressing',
  defense: 'Difesa',
  counter: 'Contropiede',
  attack: 'Attacco',
  leadManagement: 'Gestione vantaggio',
  deficitManagement: 'Reazione allo svantaggio',
  adaptability: 'Adattabilità',
  motivation: 'Motivazione',
};

export const FORM_COLORS: Record<StandingRow['form'][number], string> = { W: C.green, D: C.textMute, L: C.red };

export type TeamMap = Map<string, TeamView>;

export function teamMap(teams: TeamView[]): TeamMap {
  return new Map(teams.map((t) => [t.id, t]));
}

export const FALLBACK_LOGO = { emoji: '⚽', color: C.textMute };

/** Pulsing red "LIVE" pill. */
export function LivePill({ small }: { small?: boolean }) {
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[styles.live, small && { paddingHorizontal: 6, paddingVertical: 2 }, { opacity: pulse }]}>
      <View style={styles.liveDot} />
      <Text style={[styles.liveText, small && { fontSize: 10 }]}>LIVE</Text>
    </Animated.View>
  );
}

export function FormDots({ form }: { form: StandingRow['form'] }) {
  const last = form.slice(-5);
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {last.map((f, i) => (
        <View key={i} style={[styles.formDot, { backgroundColor: FORM_COLORS[f] }]} />
      ))}
    </View>
  );
}

export function scoreLabel(m: MatchSummary): string | null {
  if (m.status !== 'finished' || m.homeGoals === null || m.awayGoals === null) return null;
  return `${m.homeGoals} - ${m.awayGoals}`;
}

export function pensLabel(m: MatchSummary): string | null {
  if (m.status !== 'finished' || m.homePens === null || m.awayPens === null) return null;
  return `${m.homePens}-${m.awayPens} dcr`;
}

/** Home badge + name · score / vs / LIVE · away name + badge. */
export function MatchRow({ match, teams, myTeamId, onPress }: { match: MatchSummary; teams: TeamMap; myTeamId?: string | null; onPress?: () => void }) {
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  const score = scoreLabel(match);
  const pens = pensLabel(match);
  const mine = !!myTeamId && (match.homeTeamId === myTeamId || match.awayTeamId === myTeamId);
  const homeWin = score !== null && (match.homeGoals! > match.awayGoals! || (pens !== null && match.homePens! > match.awayPens!));
  const awayWin = score !== null && (match.awayGoals! > match.homeGoals! || (pens !== null && match.awayPens! > match.homePens!));
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.matchRow, mine && styles.matchRowMine, pressed && { opacity: 0.75 }]}>
      <View style={[styles.side, { justifyContent: 'flex-end' }]}>
        <Text style={[styles.teamName, { textAlign: 'right' }, homeWin && { color: C.text }, awayWin && { color: C.textDim }]} numberOfLines={1}>
          {home?.name ?? '—'}
        </Text>
        <TeamBadge logo={home?.logo ?? FALLBACK_LOGO} size={28} />
      </View>
      <View style={styles.center}>
        {match.status === 'live' ? (
          <LivePill small />
        ) : score ? (
          <>
            <Text style={[T.h3, T.number, { color: C.text }]}>{score}</Text>
            {pens ? <Text style={[T.tiny, { color: C.gold, letterSpacing: 0 }]}>{pens}</Text> : null}
          </>
        ) : (
          <Text style={[T.small, { color: C.textMute, fontWeight: '800' }]}>vs</Text>
        )}
      </View>
      <View style={styles.side}>
        <TeamBadge logo={away?.logo ?? FALLBACK_LOGO} size={28} />
        <Text style={[styles.teamName, awayWin && { color: C.text }, homeWin && { color: C.textDim }]} numberOfLines={1}>
          {away?.name ?? '—'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.red, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'center' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  formDot: { width: 7, height: 7, borderRadius: 4 },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: S.sm, borderRadius: R.sm, gap: S.xs },
  matchRowMine: { backgroundColor: `${C.gold}14` },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm, minWidth: 0 },
  center: { width: 76, alignItems: 'center', justifyContent: 'center' },
  teamName: { flexShrink: 1, color: C.text, fontWeight: '700', fontSize: 14 },
});
