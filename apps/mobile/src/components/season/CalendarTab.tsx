import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { TournamentEngine, type LeagueView, type MatchSummary } from '@asta/core';
import type { LeagueHandle } from '@/lib/hooks/useLeague';
import { C, S, T } from '@/lib/theme';
import { STAGE_IT } from '@/lib/format';
import { Button, Card, EmptyState, Pill, Row, Section } from '@/components/ui';
import { LivePill, MatchRow, type TeamMap } from './shared';

export function roundLabel(m: MatchSummary): string {
  if (TournamentEngine.isKnockout(m)) return STAGE_IT[m.stage];
  return `Giornata ${m.round}`;
}

export function CalendarTab({ view, teams, handle, leagueId }: { view: LeagueView; teams: TeamMap; handle: LeagueHandle; leagueId: string }) {
  const { isMaster, myTeam, run } = handle;
  const [busy, setBusy] = useState<'live' | 'instant' | null>(null);
  const t = view.tournament;
  const myTeamId = myTeam?.id ?? null;

  const rounds = useMemo(() => {
    const map = new Map<number, MatchSummary[]>();
    for (const m of t?.matches ?? []) {
      const list = map.get(m.round) ?? [];
      list.push(m);
      map.set(m.round, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([round, matches]) => ({ round, matches }));
  }, [t?.matches]);

  const live = useMemo(() => (t?.matches ?? []).filter((m) => m.status === 'live'), [t?.matches]);
  const pending = useMemo(() => (t ? TournamentEngine.pendingRound(t) : []), [t]);

  if (!t) return <EmptyState emoji="📅" title="Calendario non ancora pronto" body="Il Master deve avviare la stagione." />;

  const openMatch = (id: string) => router.push(`/match/${leagueId}/${id}`);

  const play = async (mode: 'live' | 'instant') => {
    setBusy(mode);
    const roundMatches = pending;
    try {
      const res = await run('round:play', { mode });
      if (mode === 'live') {
        const ids = Array.isArray(res) ? (res as unknown[]).filter((x): x is string => typeof x === 'string') : roundMatches.map((m) => m.id);
        const mine = roundMatches.find((m) => ids.includes(m.id) && (m.homeTeamId === myTeamId || m.awayTeamId === myTeamId));
        const target = mine?.id ?? ids[0];
        if (target) openMatch(target);
      }
    } catch {
      // toast already shown by run()
    } finally {
      setBusy(null);
    }
  };

  const nextLabel = pending[0] ? roundLabel(pending[0]) : null;
  const myLive = live.find((m) => m.homeTeamId === myTeamId || m.awayTeamId === myTeamId);

  return (
    <View>
      {live.length ? (
        <Card style={styles.liveBanner}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[T.h3, { color: C.text }]}>🔴 Giornata in corso</Text>
            <LivePill small />
          </Row>
          <Text style={[T.small, { marginTop: 4, marginBottom: S.md }]}>{live.length === 1 ? 'Una partita' : `${live.length} partite`} in diretta. Non perderti neanche un’azione!</Text>
          {myLive ? <Button variant="danger" icon="📺" label="GUARDA LA TUA PARTITA" onPress={() => openMatch(myLive.id)} style={{ marginBottom: S.sm }} /> : null}
          {live
            .filter((m) => m.id !== myLive?.id)
            .map((m) => (
              <Button
                key={m.id}
                small
                variant="dark"
                label={`${teams.get(m.homeTeamId)?.name ?? '—'} vs ${teams.get(m.awayTeamId)?.name ?? '—'}`}
                onPress={() => openMatch(m.id)}
                style={{ marginBottom: S.xs }}
              />
            ))}
        </Card>
      ) : view.status === 'season' && pending.length ? (
        isMaster ? (
          <Card highlight style={{ marginBottom: S.md }}>
            <Text style={[T.tiny, { color: C.gold }]}>👑 CONTROLLI DEL MASTER</Text>
            <Text style={[T.h2, { marginTop: 4 }]}>Prossima: {nextLabel}</Text>
            <Text style={[T.small, { marginTop: 2, marginBottom: S.md }]}>
              {pending.length} {pending.length === 1 ? 'partita' : 'partite'} in programma. Diretta condivisa per tutti o risultato secco?
            </Text>
            {view.teamTalk && !view.teamTalk.given ? (
              <Text style={[T.small, { color: C.gold, marginBottom: S.md }]}>🎙️ {view.teamTalk.reason}: fai il discorso alla squadra prima di avviare, dopo non si potrà più.</Text>
            ) : null}
            <Button variant="gold" label="▶ GIOCA LIVE" loading={busy === 'live'} disabled={busy !== null} onPress={() => void play('live')} style={{ marginBottom: S.sm }} />
            <Button variant="ghost" label="⚡ SIMULA SUBITO" loading={busy === 'instant'} disabled={busy !== null} onPress={() => void play('instant')} />
          </Card>
        ) : (
          <Card style={{ marginBottom: S.md, alignItems: 'center' }}>
            <Text style={{ fontSize: 28 }}>⏳</Text>
            <Text style={[T.h3, { marginTop: S.xs, textAlign: 'center' }]}>In attesa che il Master avvii la giornata</Text>
            {nextLabel ? <Text style={[T.small, { marginTop: 2 }]}>Prossima: {nextLabel}</Text> : null}
          </Card>
        )
      ) : null}

      {rounds.map(({ round, matches }) => {
        const first = matches[0];
        const done = matches.every((m) => m.status === 'finished');
        const isLive = matches.some((m) => m.status === 'live');
        const isNext = !isLive && pending[0]?.round === round;
        return (
          <Section
            key={round}
            title={`${roundLabel(first)}${first.stage === 'group' ? ' · Gironi' : ''}`}
            right={isLive ? <LivePill small /> : isNext ? <Pill label="PROSSIMA" /> : done ? <Pill label="FINITA" color={C.textMute} /> : null}
            style={{ marginTop: S.lg }}>
            <Card style={{ padding: S.xs }}>
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} teams={teams} myTeamId={myTeamId} onPress={() => openMatch(m.id)} />
              ))}
            </Card>
          </Section>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  liveBanner: { borderColor: C.red, backgroundColor: '#2A0F16', marginBottom: S.md },
});
