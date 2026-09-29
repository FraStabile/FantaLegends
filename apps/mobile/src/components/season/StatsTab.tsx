import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { leaderboard, type Catalog, type LeagueView, type PlayerLeaderboardKey, type PlayerSeasonStats, type TeamSeasonStats } from '@asta/core';
import { C, S, T } from '@/lib/theme';
import { Card, Chip, EmptyState, Section, TeamBadge } from '@/components/ui';
import { FALLBACK_LOGO, type TeamMap } from './shared';
import { useSeasonStats } from './useSeasonStats';

type BoardKey = Exclude<PlayerLeaderboardKey, 'tackles'>;

const BOARDS: { key: BoardKey; label: string; emoji: string; unit?: string }[] = [
  { key: 'goals', label: 'Marcatori', emoji: '⚽' },
  { key: 'assists', label: 'Assist', emoji: '🎯' },
  { key: 'cleanSheets', label: 'Clean sheet', emoji: '🧱' },
  { key: 'mvps', label: 'MVP', emoji: '⭐' },
  { key: 'avgRating', label: 'Media voto', emoji: '📈' },
  { key: 'shots', label: 'Tiri', emoji: '👟' },
  { key: 'passes', label: 'Passaggi', emoji: '➡️' },
  { key: 'dribbles', label: 'Dribbling', emoji: '🌀' },
  { key: 'saves', label: 'Parate', emoji: '🧤' },
  { key: 'yellows', label: 'Cartellini', emoji: '🟨' },
  { key: 'goalsConceded', label: 'Gol subiti', emoji: '🥅' },
];

export function StatsTab({ view, teams, catalog, leagueId, myTeamId }: { view: LeagueView; teams: TeamMap; catalog: Catalog; leagueId: string; myTeamId: string | null }) {
  const { stats, loading, error } = useSeasonStats(leagueId, view.version);
  const [board, setBoard] = useState<BoardKey>('goals');

  const rows = useMemo(() => {
    if (!stats) return [];
    let pool: PlayerSeasonStats[] = stats.players;
    if (board === 'goalsConceded' || board === 'saves' || board === 'cleanSheets') {
      pool = pool.filter((p) => {
        const item = catalog.find(p.playerId);
        return item?.kind === 'player' && item.position === 'GK';
      });
    }
    const maxApps = Math.max(0, ...stats.players.map((p) => p.apps));
    const minApps = board === 'avgRating' ? Math.max(1, Math.ceil(maxApps / 2)) : 1;
    return leaderboard(pool, board, 10, minApps);
  }, [stats, board, catalog]);

  if (!stats) {
    if (error) return <EmptyState emoji="📡" title="Statistiche non disponibili" body={error} />;
    return <ActivityIndicator color={C.gold} style={{ marginTop: S.xxl }} />;
  }
  if (!stats.players.length) {
    return <EmptyState emoji="📊" title="Ancora nessuna statistica" body="Gioca la prima giornata: qui nasceranno bomber, saracinesche e macellai." />;
  }

  const current = BOARDS.find((b) => b.key === board)!;
  const fmt = (v: number) => (board === 'avgRating' ? v.toFixed(2) : String(v));

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: S.md }} contentContainerStyle={{ paddingRight: S.lg }}>
        {BOARDS.map((b) => (
          <Chip key={b.key} label={`${b.emoji} ${b.label}`} active={b.key === board} onPress={() => setBoard(b.key)} />
        ))}
      </ScrollView>

      <Section title={`${current.emoji} ${current.label}`} right={loading ? <ActivityIndicator size="small" color={C.gold} /> : null} style={{ marginTop: S.md }}>
        <Card style={{ padding: S.xs }}>
          {rows.length ? (
            rows.map((r, i) => {
              const item = catalog.find(r.playerId);
              const team = teams.get(r.teamId);
              const mine = r.teamId === myTeamId;
              return (
                <Pressable
                  key={r.playerId}
                  onPress={() => router.push(`/player/${r.playerId}?league=${leagueId}`)}
                  style={({ pressed }) => [styles.lbRow, mine && { backgroundColor: `${C.gold}14` }, pressed && { opacity: 0.75 }]}>
                  <Text style={[styles.rank, i === 0 && { color: C.gold }, i === 1 && { color: '#C9D1DE' }, i === 2 && { color: '#CD7F32' }]}>{i + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={T.h3} numberOfLines={1}>
                      {item ? item.name : r.playerId}
                    </Text>
                    <Text style={T.small} numberOfLines={1}>
                      {team?.name ?? '—'} · {r.apps} pres.
                    </Text>
                  </View>
                  <TeamBadge logo={team?.logo ?? FALLBACK_LOGO} size={26} />
                  <Text style={[styles.value, i === 0 && { color: C.goldBright }]}>{fmt(r[board])}</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={[T.small, { padding: S.md, textAlign: 'center' }]}>Nessun dato per questa classifica… per ora.</Text>
          )}
        </Card>
        {board === 'avgRating' ? <Text style={[T.small, { marginTop: 6 }]}>Minimo metà delle presenze massime per entrare in classifica.</Text> : null}
      </Section>

      <Section title="Statistiche squadre">
        <TeamStatsTable rows={stats.teams} teams={teams} myTeamId={myTeamId} />
      </Section>
    </View>
  );
}

const TEAM_COLS: { label: string; get: (t: TeamSeasonStats) => string; w?: number }[] = [
  { label: 'GF', get: (t) => String(t.goalsFor) },
  { label: 'GS', get: (t) => String(t.goalsAgainst) },
  { label: 'POS%', get: (t) => `${Math.round(t.avgPossession)}`, w: 34 },
  { label: 'TIRI', get: (t) => t.avgShots.toFixed(1), w: 34 },
  { label: 'xG', get: (t) => t.xgFor.toFixed(1), w: 34 },
  { label: 'V', get: (t) => String(t.won) },
  { label: 'S', get: (t) => String(t.lost) },
];

export function TeamStatsTable({ rows, teams, myTeamId }: { rows: TeamSeasonStats[]; teams: TeamMap; myTeamId: string | null }) {
  const sorted = [...rows].sort((a, b) => b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={[styles.tRow, { backgroundColor: C.bgElevated }]}>
        <Text style={[styles.tHead, { flex: 1 }]}>SQUADRA</Text>
        {TEAM_COLS.map((c) => (
          <Text key={c.label} style={[styles.tHead, styles.tNum, c.w ? { width: c.w } : null]}>
            {c.label}
          </Text>
        ))}
      </View>
      {sorted.map((r) => {
        const team = teams.get(r.teamId);
        return (
          <View key={r.teamId} style={[styles.tRow, r.teamId === myTeamId && { backgroundColor: `${C.gold}16` }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <TeamBadge logo={team?.logo ?? FALLBACK_LOGO} size={22} />
              <Text style={[T.small, { color: C.text, fontWeight: '800', flexShrink: 1 }]} numberOfLines={1}>
                {team?.name ?? '—'}
              </Text>
            </View>
            {TEAM_COLS.map((c) => (
              <Text key={c.label} style={[styles.tNum, styles.tVal, c.w ? { width: c.w } : null]}>
                {c.get(r)}
              </Text>
            ))}
          </View>
        );
      })}
      <Text style={[T.small, { padding: S.sm, fontSize: 11 }]}>POS% possesso medio · TIRI tiri medi a partita · xG gol attesi totali · V vittorie · S sconfitte</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 9, paddingHorizontal: S.sm, borderRadius: 8 },
  rank: { width: 24, textAlign: 'center', color: C.textDim, fontWeight: '900', fontSize: 15, ...T.number },
  value: { minWidth: 44, textAlign: 'right', color: C.text, fontWeight: '900', fontSize: 18, ...T.number },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: S.sm, borderBottomWidth: 1, borderBottomColor: C.border, gap: 2 },
  tHead: { color: C.textMute, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  tNum: { width: 26, textAlign: 'center' },
  tVal: { color: C.textDim, fontSize: 12, fontWeight: '700', ...T.number },
});
