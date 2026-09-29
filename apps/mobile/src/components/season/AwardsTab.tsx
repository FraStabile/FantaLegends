import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Award, Catalog, LeagueView, SeasonArchive } from '@asta/core';
import { C, R, S, T } from '@/lib/theme';
import { Card, EmptyState, Pill, Row, Section, TeamBadge } from '@/components/ui';
import { AWARD_EMOJI, FALLBACK_LOGO, type TeamMap } from './shared';

// ───────────────────────────── PREMI

export function AwardsTab({ view, teams, catalog, leagueId }: { view: LeagueView; teams: TeamMap; catalog: Catalog; leagueId: string }) {
  if (!view.awards.length) {
    return <EmptyState emoji="🏅" title="Bacheca ancora vuota" body="I premi verranno assegnati alla fine del torneo. Chi alzerà la Scarpa d'Oro?" />;
  }
  const champion = view.awards.find((a) => a.key === 'champion');
  const rest = view.awards.filter((a) => a !== champion);
  return (
    <View>
      {champion ? <AwardCard award={champion} teams={teams} catalog={catalog} leagueId={leagueId} hero /> : null}
      <View style={styles.grid}>
        {rest.map((a) => (
          <View key={a.key} style={styles.gridItem}>
            <AwardCard award={a} teams={teams} catalog={catalog} leagueId={leagueId} />
          </View>
        ))}
      </View>
    </View>
  );
}

function AwardCard({ award, teams, catalog, leagueId, hero }: { award: Award; teams: TeamMap; catalog: Catalog; leagueId: string; hero?: boolean }) {
  const team = award.teamId ? teams.get(award.teamId) : undefined;
  const item = award.itemId ? catalog.find(award.itemId) : undefined;
  const shame = award.key === 'worst_buy';
  return (
    <Card
      highlight={hero}
      onPress={item ? () => router.push(`/player/${item.id}?league=${leagueId}`) : undefined}
      style={[hero && { alignItems: 'center', paddingVertical: S.xl, marginTop: S.md }, shame && { borderColor: `${C.red}88` }, { flex: 1 }]}>
      <Text style={{ fontSize: hero ? 52 : 30 }}>{AWARD_EMOJI[award.key]}</Text>
      <Text style={[T.tiny, { color: shame ? C.red : C.gold, marginTop: S.sm, textAlign: hero ? 'center' : 'left' }]}>{award.title}</Text>
      <Text style={[hero ? T.h1 : T.h3, { marginTop: 4, textAlign: hero ? 'center' : 'left', color: hero ? C.goldBright : C.text }]} numberOfLines={2}>
        {item?.name ?? team?.name ?? '—'}
      </Text>
      {award.value ? (
        <View style={{ marginTop: S.xs, alignSelf: hero ? 'center' : 'flex-start' }}>
          <Pill label={award.value} color={shame ? C.red : C.gold} solid={hero} />
        </View>
      ) : null}
      {award.description ? <Text style={[T.small, { marginTop: S.sm, textAlign: hero ? 'center' : 'left' }]}>{award.description}</Text> : null}
      {team && item ? (
        <Row style={{ marginTop: S.sm }} gap={6}>
          <TeamBadge logo={team.logo} size={20} />
          <Text style={[T.small, { flexShrink: 1 }]} numberOfLines={1}>
            {team.name}
          </Text>
        </Row>
      ) : null}
    </Card>
  );
}

// ───────────────────────────── ALBO D'ORO

export function HistoryTab({ view, teams, catalog }: { view: LeagueView; teams: TeamMap; catalog: Catalog }) {
  const history = [...view.history].sort((a, b) => b.season - a.season);
  const currentChampionId = view.tournament?.phase === 'completed' ? view.tournament.championTeamId : null;
  const currentChampion = currentChampionId ? teams.get(currentChampionId) : undefined;
  const alreadyArchived = history.some((h) => h.season === view.season);

  if (!history.length && !currentChampion) {
    return <EmptyState emoji="📜" title="Albo d'oro ancora da scrivere" body="Il primo nome inciso qui resterà nella leggenda della lega. Sarà il tuo?" />;
  }

  return (
    <View>
      {currentChampion && !alreadyArchived ? (
        <Card highlight style={[styles.goldCard, { marginTop: S.md }]}>
          <Text style={[T.tiny, { color: C.gold }]}>STAGIONE {view.season} · IN CARICA</Text>
          <Row style={{ marginTop: S.sm }} gap={S.md}>
            <TeamBadge logo={currentChampion.logo} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[T.small, { color: C.goldBright }]}>🏆 Campione</Text>
              <Text style={[T.h1, { color: C.goldBright }]} numberOfLines={1}>
                {currentChampion.name}
              </Text>
            </View>
          </Row>
          <View style={{ marginTop: S.md }}>
            {view.standings.slice(0, 3).map((r, i) => (
              <PodiumRow key={r.teamId} pos={i} name={teams.get(r.teamId)?.name ?? '—'} logo={teams.get(r.teamId)?.logo} points={r.points} />
            ))}
          </View>
        </Card>
      ) : null}
      {history.map((h) => (
        <ArchiveCard key={h.season} archive={h} catalog={catalog} />
      ))}
    </View>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function PodiumRow({ pos, name, logo, points }: { pos: number; name: string; logo?: { emoji: string; color: string }; points: number }) {
  return (
    <Row style={styles.podiumRow} gap={S.sm}>
      <Text style={{ fontSize: 18, width: 26 }}>{MEDALS[pos]}</Text>
      <TeamBadge logo={logo ?? FALLBACK_LOGO} size={24} />
      <Text style={[T.body, { flex: 1, fontWeight: '800' }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[T.small, T.number, { color: C.text, fontWeight: '900' }]}>{points} pt</Text>
    </Row>
  );
}

function ArchiveCard({ archive, catalog }: { archive: SeasonArchive; catalog: Catalog }) {
  const teamOf = (id: string | null) => archive.teams.find((t) => t.id === id);
  const champ = teamOf(archive.championTeamId);
  const keyAwards = archive.awards.filter((a) => a.key !== 'champion').slice(0, 6);
  return (
    <Section title={`Stagione ${archive.season}`} right={<Text style={T.small}>{new Date(archive.finishedAt).toLocaleDateString('it-IT')}</Text>}>
      <Card highlight style={styles.goldCard}>
        <Row gap={S.md}>
          <TeamBadge logo={champ?.logo ?? FALLBACK_LOGO} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={[T.tiny, { color: C.gold }]}>🏆 Campione</Text>
            <Text style={[T.h1, { color: C.goldBright }]} numberOfLines={1}>
              {archive.championName || champ?.name || '—'}
            </Text>
            {champ ? <Text style={T.small}>di {champ.ownerName}</Text> : null}
          </View>
        </Row>

        {archive.standings.length ? (
          <View style={{ marginTop: S.md }}>
            {archive.standings.slice(0, 3).map((r, i) => {
              const t = teamOf(r.teamId);
              return <PodiumRow key={r.teamId} pos={i} name={t?.name ?? '—'} logo={t?.logo} points={r.points} />;
            })}
          </View>
        ) : null}

        {keyAwards.length ? (
          <View style={{ marginTop: S.md }}>
            <Text style={[T.tiny, { marginBottom: S.xs }]}>Premi</Text>
            {keyAwards.map((a) => {
              const item = a.itemId ? catalog.find(a.itemId) : undefined;
              return (
                <Row key={a.key} style={{ paddingVertical: 4 }} gap={S.sm}>
                  <Text style={{ fontSize: 16, width: 24 }}>{AWARD_EMOJI[a.key]}</Text>
                  <Text style={[T.small, { flex: 1 }]} numberOfLines={1}>
                    {a.title}: <Text style={{ color: C.text, fontWeight: '800' }}>{item?.name ?? teamOf(a.teamId)?.name ?? '—'}</Text>
                  </Text>
                  {a.value ? <Text style={[T.small, { color: C.gold, fontWeight: '800' }]}>{a.value}</Text> : null}
                </Row>
              );
            })}
          </View>
        ) : null}

        {archive.records.length ? (
          <View style={styles.records}>
            {archive.records.map((r) => (
              <View key={r.label} style={styles.record}>
                <Text style={[T.tiny, { letterSpacing: 0.4 }]} numberOfLines={2}>
                  {r.label}
                </Text>
                <Text style={[T.h3, { marginTop: 2 }]} numberOfLines={2}>
                  {r.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -S.xs, marginTop: S.sm },
  gridItem: { width: '50%', padding: S.xs },
  goldCard: { borderColor: C.gold, backgroundColor: '#17150C' },
  podiumRow: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: `${C.gold}22` },
  records: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.md },
  record: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.bgElevated, borderRadius: R.sm, padding: S.sm, borderWidth: 1, borderColor: C.border },
});
