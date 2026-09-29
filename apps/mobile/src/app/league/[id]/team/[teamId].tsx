import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { missingLabels, strengthView, type CatalogItem, type Coach, type CoachModifiers, type Player, type RosterEntry, type Slot } from '@asta/core';
import { useLeague } from '@/lib/hooks/useLeague';
import { C, R, S, T } from '@/lib/theme';
import { SLOT_IT, TACTIC_IT } from '@/lib/format';
import { Card, EmptyState, ItemRow, Pill, Row, Screen, Section, StatBar, TeamBadge } from '@/components/ui';
import { useSeasonStats } from '@/components/season/useSeasonStats';
import { MODIFIER_IT } from '@/components/season/shared';

const SLOT_ORDER: Slot[] = ['GK', 'DF', 'MF', 'FW', 'COACH'];


function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function TeamDetailScreen() {
  const params = useLocalSearchParams<{ id: string; teamId: string }>();
  const leagueId = param(params.id) ?? '';
  const teamId = param(params.teamId) ?? '';
  const { view, catalog, myTeam, error } = useLeague(leagueId);
  const team = view?.teams.find((t) => t.id === teamId) ?? null;
  const seasonOn = view?.status === 'season' || view?.status === 'completed';
  const { stats } = useSeasonStats(leagueId, view?.version, seasonOn);

  // React Compiler memoizes these derivations
  const roster = team?.roster
    ? [...team.roster]
        .map((r) => ({ entry: r, item: catalog.find(r.itemId) }))
        .sort((a, b) => SLOT_ORDER.indexOf(a.entry.slot) - SLOT_ORDER.indexOf(b.entry.slot) || (b.item?.overall ?? 0) - (a.item?.overall ?? 0))
    : null;
  const rosterPlayers = roster ? roster.map((r) => r.item).filter((i): i is Player => i?.kind === 'player') : [];
  const rosterCoach = roster?.map((r) => r.item).find((i): i is Coach => i?.kind === 'coach') ?? null;
  const strength = rosterPlayers.length ? { view: strengthView(rosterPlayers, rosterCoach), coach: rosterCoach } : null;

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/league/${leagueId}`));

  if (!view) {
    return (
      <Screen scroll={false}>
        {error ? <EmptyState emoji="📡" title="Lega non raggiungibile" body={error} /> : <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 80 }} />}
      </Screen>
    );
  }
  if (!team) {
    return (
      <Screen>
        <BackLink onPress={back} />
        <EmptyState emoji="🕵️" title="Squadra non trovata" body="Forse ha cambiato lega… o non è mai esistita." />
      </Screen>
    );
  }

  const owner = view.members.find((m) => m.userId === team.ownerId);
  const mine = team.id === myTeam?.id;
  const rosterValue = team.roster ? team.roster.reduce((s, r) => s + r.price, 0) : null;
  const missing = missingLabels(team.needs);
  const teamStats = stats?.teams.find((t) => t.teamId === team.id);
  const topPlayers = stats ? [...stats.players].filter((p) => p.teamId === team.id).sort((a, b) => b.goals - a.goals || b.avgRating - a.avgRating).slice(0, 3) : [];
  const standingPos = view.standings.findIndex((s) => s.teamId === team.id);

  return (
    <Screen>
      <BackLink onPress={back} />
      <View style={[styles.hero, { borderColor: team.logo.color }]}>
        <View style={[styles.heroGlow, { backgroundColor: `${team.logo.color}22` }]} />
        <TeamBadge logo={team.logo} size={92} />
        <Text style={[T.h1, { marginTop: S.md, textAlign: 'center' }]} numberOfLines={2}>
          {team.name}
        </Text>
        <Text style={[T.small, { marginTop: 2 }]}>
          {owner ? `${owner.avatar} ${owner.displayName}` : '—'}
          {owner?.bot ? ' · 🤖 bot' : ''}
          {owner?.isMaster ? ' · 👑 Master' : ''}
        </Text>
        <Row style={{ marginTop: S.sm }} gap={6}>
          {mine ? <Pill label="LA TUA SQUADRA" solid /> : null}
          {standingPos >= 0 ? <Pill label={`${standingPos + 1}° IN CLASSIFICA`} color={C.cyan} /> : null}
        </Row>
      </View>

      <View style={styles.kpis}>
        <Kpi label="Crediti iniziali" value={`${view.config.startingCredits}`} />
        <Kpi label="Rimasti" value={team.credits === null ? '🔒' : `${team.credits}`} gold />
        <Kpi label="Valore rosa" value={rosterValue === null ? '🔒' : `${rosterValue}`} />
      </View>

      {missing.length ? (
        <Card style={{ marginTop: S.md, borderColor: `${C.orange}88` }}>
          <Text style={[T.tiny, { color: C.orange }]}>Slot mancanti</Text>
          <Row style={{ flexWrap: 'wrap', marginTop: S.sm }} gap={6}>
            {missing.map((m) => (
              <Pill key={m} label={m} color={C.orange} />
            ))}
          </Row>
        </Card>
      ) : null}

      {strength ? (
        <Section title="Forza della squadra" right={<Text style={[T.h3, { color: C.gold }]}>{strength.view.overall} OVR</Text>}>
          <Card>
            <StatBar label="⚔️ Attacco" value={strength.view.attack} />
            <StatBar label="🎩 Centrocampo" value={strength.view.midfield} />
            <StatBar label="🛡️ Difesa" value={strength.view.defense} />
            <StatBar label="🧤 Portiere" value={strength.view.goalkeeper} />
            <StatBar label="⭐ Overall" value={strength.view.overall} />
          </Card>
        </Section>
      ) : null}

      {strength?.coach ? <CoachCard coach={strength.coach} onPress={() => router.push(`/player/${strength.coach!.id}?league=${leagueId}`)} /> : null}

      <Section title={`Rosa${team.roster ? ` · ${team.rosterCount}` : ''}`}>
        {roster ? (
          roster.length ? (
            <Card style={{ paddingVertical: S.xs }}>
              {roster.map(({ entry, item }) => (item ? <RosterRow key={entry.itemId} entry={entry} item={item} leagueId={leagueId} /> : null))}
            </Card>
          ) : (
            <EmptyState emoji="🛒" title="Rosa vuota" body="Il carrello è ancora vuoto: l'asta aspetta!" />
          )
        ) : (
          <Card style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 32 }}>🔒</Text>
            <Text style={[T.h3, { marginTop: S.sm, textAlign: 'center' }]}>Rosa nascosta dalle regole della lega</Text>
            <Text style={[T.small, { textAlign: 'center', marginTop: 4 }]}>La scoprirai a fine asta. Nel frattempo… bluffa.</Text>
          </Card>
        )}
      </Section>

      {teamStats ? (
        <Section title="Stagione">
          <Card>
            <View style={styles.statGrid}>
              <Mini label="Partite" value={teamStats.played} />
              <Mini label="V / N / P" value={`${teamStats.won}/${teamStats.drawn}/${teamStats.lost}`} />
              <Mini label="Gol fatti" value={teamStats.goalsFor} />
              <Mini label="Gol subiti" value={teamStats.goalsAgainst} />
              <Mini label="Possesso" value={`${Math.round(teamStats.avgPossession)}%`} />
              <Mini label="Tiri medi" value={teamStats.avgShots.toFixed(1)} />
              <Mini label="xG" value={teamStats.xgFor.toFixed(1)} />
              <Mini label="Clean sheet" value={teamStats.cleanSheets} />
            </View>
            {topPlayers.length ? (
              <View style={{ marginTop: S.md }}>
                <Text style={[T.tiny, { marginBottom: S.xs }]}>Trascinatori</Text>
                {topPlayers.map((p) => (
                  <Row key={p.playerId} style={{ paddingVertical: 4 }}>
                    <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>
                      {catalog.find(p.playerId)?.name ?? p.playerId}
                    </Text>
                    <Text style={[T.small, T.number]}>
                      ⚽ {p.goals} · 🎯 {p.assists} · 📈 {p.avgRating.toFixed(1)}
                    </Text>
                  </Row>
                ))}
              </View>
            ) : null}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: S.sm }}>
      <Text style={[T.body, { color: C.gold, fontWeight: '800' }]}>‹ Indietro</Text>
    </Pressable>
  );
}

function Kpi({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.kpi}>
      <Text style={[T.h2, T.number, gold && { color: C.goldBright }]}>{value}</Text>
      <Text style={[T.tiny, { letterSpacing: 0.4, textAlign: 'center', marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.mini}>
      <Text style={[T.h3, T.number]}>{value}</Text>
      <Text style={[T.small, { fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

function RosterRow({ entry, item, leagueId }: { entry: RosterEntry; item: CatalogItem; leagueId: string }) {
  return (
    <ItemRow
      item={item}
      subtitle={`${SLOT_IT[entry.slot]} · Prime ${item.primePeriod}${item.kind === 'player' ? ` · ${item.historicalClub}` : ''}`}
      onPress={() => router.push(`/player/${item.id}?league=${leagueId}`)}
      right={
        <View style={{ alignItems: 'flex-end', minWidth: 56, gap: 3 }}>
          <Text style={[T.h3, T.number, { color: C.gold }]}>{entry.price} cr</Text>
          {entry.autoAssigned ? <Pill label="d'ufficio" color={C.textDim} /> : null}
        </View>
      }
    />
  );
}

function CoachCard({ coach, onPress }: { coach: Coach; onPress: () => void }) {
  const mods = (Object.keys(MODIFIER_IT) as (keyof CoachModifiers)[]).filter((k) => coach.modifiers[k] !== 0);
  return (
    <Section title="Allenatore">
      <Card onPress={onPress}>
        <Row gap={S.md}>
          <View style={styles.coachIcon}>
            <Text style={{ fontSize: 26 }}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.h2} numberOfLines={1}>
              {coach.name}
            </Text>
            <Text style={T.small} numberOfLines={2}>
              {coach.style}
            </Text>
          </View>
          <Text style={[T.h1, { color: C.gold }]}>{coach.overall}</Text>
        </Row>
        <Row style={{ marginTop: S.md }}>
          <Pill label={`🧠 ${TACTIC_IT[coach.preferredTactic]}`} color={C.cyan} />
        </Row>
        <View style={styles.mods}>
          {mods.map((k) => {
            const v = coach.modifiers[k];
            const c = v > 0 ? C.green : C.red;
            return (
              <View key={k} style={[styles.mod, { borderColor: `${c}66`, backgroundColor: `${c}14` }]}>
                <Text style={{ color: c, fontWeight: '900', fontSize: 13, ...T.number }}>
                  {v > 0 ? `+${v}` : v} <Text style={{ color: C.text, fontWeight: '700', fontFamily: undefined }}>{MODIFIER_IT[k]}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: S.xl, borderRadius: R.lg, borderWidth: 1, backgroundColor: C.card, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -80, width: 260, height: 260, borderRadius: 130 },
  kpis: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
  kpi: { flex: 1, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingVertical: S.md, alignItems: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: S.md },
  mini: { width: '25%', alignItems: 'center' },
  coachIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: `${C.gold}22`, borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  mods: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: S.md },
  mod: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, borderWidth: 1 },
});
