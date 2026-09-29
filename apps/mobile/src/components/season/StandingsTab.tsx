import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { TournamentEngine, type LeagueView, type MatchStage, type MatchSummary, type StandingRow } from '@asta/core';
import { C, R, S, T } from '@/lib/theme';
import { STAGE_IT } from '@/lib/format';
import { Card, EmptyState, Section, TeamBadge } from '@/components/ui';
import { FALLBACK_LOGO, FormDots, MatchRow, type TeamMap } from './shared';

const COLS: { key: keyof StandingRow; label: string }[] = [
  { key: 'played', label: 'PG' },
  { key: 'won', label: 'V' },
  { key: 'drawn', label: 'N' },
  { key: 'lost', label: 'P' },
  { key: 'goalsFor', label: 'GF' },
  { key: 'goalsAgainst', label: 'GS' },
  { key: 'goalDiff', label: 'DR' },
  { key: 'points', label: 'PT' },
];

const STAGE_ORDER: MatchStage[] = ['round16', 'quarterfinal', 'semifinal', 'final'];

export function StandingsTab({ view, teams, myTeamId, leagueId }: { view: LeagueView; teams: TeamMap; myTeamId: string | null; leagueId: string }) {
  const t = view.tournament;
  const groupMap = t?.groups ?? null;
  const standings = view.standings;
  const groups = useMemo(() => {
    if (!groupMap) return null;
    return Object.keys(groupMap)
      .sort()
      .map((g) => ({ g, rows: standings.filter((r) => r.group === g) }));
  }, [groupMap, standings]);

  const knockout = useMemo(() => (t ? t.matches.filter((m) => TournamentEngine.isKnockout(m)) : []), [t]);
  const showBracket = !!t && t.phase !== 'regular' && knockout.length > 0;

  const leagueQualify = view.config.playoffs && view.teams.length >= 3 ? Math.min(view.config.playoffTeams, view.teams.length >= 4 ? 4 : 2) : 1;

  if (!view.standings.length && !showBracket) {
    return <EmptyState emoji="📊" title="Classifica vuota" body="Si parte tutti da zero punti. Il primo fischio è dietro l'angolo!" />;
  }

  return (
    <View>
      {showBracket ? <Bracket matches={knockout} teams={teams} myTeamId={myTeamId} leagueId={leagueId} championId={t?.championTeamId ?? null} /> : null}
      {groups ? (
        groups.map(({ g, rows }) => (
          <Section key={g} title={`Girone ${g}`}>
            <StandingsTable rows={rows} teams={teams} myTeamId={myTeamId} qualify={2} />
          </Section>
        ))
      ) : view.standings.length ? (
        <Section title={t?.format === 'knockout' ? 'Rendimento' : 'Classifica'}>
          <StandingsTable rows={view.standings} teams={teams} myTeamId={myTeamId} qualify={leagueQualify} />
        </Section>
      ) : null}
      <View style={styles.legend}>
        <LegendDot color={C.green} label="Vittoria" />
        <LegendDot color={C.textMute} label="Pareggio" />
        <LegendDot color={C.red} label="Sconfitta" />
        <LegendDot color={C.gold} label={groups || leagueQualify > 1 ? 'Zona playoff' : 'Vetta'} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={T.small}>{label}</Text>
    </View>
  );
}

export function StandingsTable({ rows, teams, myTeamId, qualify }: { rows: StandingRow[]; teams: TeamMap; myTeamId: string | null; qualify: number }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={[styles.row, styles.headRow]}>
        <Text style={[styles.pos, styles.head]}>#</Text>
        <Text style={[styles.head, { flex: 1 }]}>SQUADRA</Text>
        {COLS.map((c) => (
          <Text key={c.key} style={[styles.num, styles.head, c.key === 'points' && styles.pts]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => {
        const team = teams.get(r.teamId);
        const mine = r.teamId === myTeamId;
        const top = i < qualify;
        return (
          <View key={r.teamId} style={[styles.row, mine && styles.mine, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[styles.posBox, top && { backgroundColor: i === 0 ? C.gold : `${C.gold}33` }]}>
              <Text style={[styles.posText, top && { color: i === 0 ? '#1A1405' : C.goldBright }]}>{i + 1}</Text>
            </View>
            <View style={styles.teamCell}>
              <TeamBadge logo={team?.logo ?? FALLBACK_LOGO} size={24} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.teamName, mine && { color: C.goldBright }]} numberOfLines={1}>
                  {team?.name ?? '—'}
                </Text>
                {r.form.length ? <FormDots form={r.form} /> : null}
              </View>
            </View>
            {COLS.map((c) => {
              const v = r[c.key] as number;
              return (
                <Text key={c.key} style={[styles.num, c.key === 'points' && styles.pts, c.key === 'goalDiff' && { color: v > 0 ? C.green : v < 0 ? C.red : C.textDim }]}>
                  {c.key === 'goalDiff' && v > 0 ? `+${v}` : v}
                </Text>
              );
            })}
          </View>
        );
      })}
    </Card>
  );
}

function Bracket({ matches, teams, myTeamId, leagueId, championId }: { matches: MatchSummary[]; teams: TeamMap; myTeamId: string | null; leagueId: string; championId: string | null }) {
  const stages = STAGE_ORDER.map((s) => ({ stage: s, list: matches.filter((m) => m.stage === s) })).filter((x) => x.list.length);
  const champ = championId ? teams.get(championId) : null;
  return (
    <Section title="Tabellone playoff" right={<Text style={[T.tiny, { color: C.gold }]}>⚔️ DENTRO O FUORI</Text>}>
      {stages.map(({ stage, list }) => (
        <Card key={stage} style={[styles.stageCard, stage === 'final' && { borderColor: C.gold }]}>
          <Text style={[T.tiny, { color: stage === 'final' ? C.gold : C.textDim, marginBottom: S.xs }]}>{STAGE_IT[stage]}</Text>
          {list.map((m) => (
            <MatchRow key={m.id} match={m} teams={teams} myTeamId={myTeamId} onPress={() => router.push(`/match/${leagueId}/${m.id}`)} />
          ))}
        </Card>
      ))}
      {champ ? (
        <Card highlight style={{ alignItems: 'center', marginTop: S.sm }}>
          <Text style={{ fontSize: 34 }}>🏆</Text>
          <TeamBadge logo={champ.logo} size={48} />
          <Text style={[T.h2, { color: C.goldBright, marginTop: S.sm }]}>{champ.name}</Text>
          <Text style={T.small}>Campione della stagione</Text>
        </Card>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: S.sm, borderBottomWidth: 1, borderBottomColor: C.border, gap: 2 },
  headRow: { backgroundColor: C.bgElevated, paddingVertical: 8 },
  head: { color: C.textMute, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  mine: { backgroundColor: `${C.gold}16` },
  pos: { width: 24, textAlign: 'center' },
  posBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  posText: { color: C.textDim, fontWeight: '900', fontSize: 12, ...T.number },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, marginLeft: 4 },
  teamName: { color: C.text, fontWeight: '800', fontSize: 13, marginBottom: 2 },
  num: { width: 24, textAlign: 'center', color: C.textDim, fontSize: 12, fontWeight: '700', ...T.number },
  pts: { width: 28, color: C.text, fontWeight: '900' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md, marginTop: S.md, justifyContent: 'center' },
  stageCard: { padding: S.sm, marginBottom: S.sm, borderRadius: R.md },
});
