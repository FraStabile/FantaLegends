import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Catalog, eligibleItems, totalSlots, SLOTS, type LeagueView, type Slot } from '@asta/core';
import { C, R, S, SLOT_COLORS, T } from '@/lib/theme';
import { FORMAT_IT, SLOT_SHORT, TONE_IT, timeAgo } from '@/lib/format';
import { Card, Divider, Row, Section, TeamBadge } from '@/components/ui';
import { rosterSummary } from './LeagueConfigForm';

export function rosterValue(team: LeagueView['teams'][number]): number | null {
  return team.roster ? team.roster.reduce((s, r) => s + r.price, 0) : null;
}

export function TeamsList({ view, title = 'Squadre' }: { view: LeagueView; title?: string }) {
  const slots = totalSlots(view.config);
  return (
    <Section title={`${title} · ${view.teams.length}`}>
      <Card style={{ paddingVertical: S.xs }}>
        {view.teams.map((t, i) => {
          const owner = view.members.find((m) => m.userId === t.ownerId);
          const mine = owner?.userId === view.viewerId;
          return (
            <View key={t.id}>
              {i > 0 ? <View style={styles.sep} /> : null}
              <Card onPress={() => router.push(`/league/${view.id}/team/${t.id}`)} style={styles.teamRow}>
                <Row gap={S.md}>
                  <TeamBadge logo={t.logo} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.h3, mine && { color: C.gold }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={T.small} numberOfLines={1}>
                      {owner ? `${owner.avatar} ${owner.displayName}` : '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[T.h3, T.number, { color: C.gold }]}>{t.credits === null ? '🔒' : `${t.credits} cr`}</Text>
                    <Text style={[T.small, T.number]}>
                      {t.rosterCount}/{slots}
                    </Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </Row>
              </Card>
            </View>
          );
        })}
      </Card>
    </Section>
  );
}

export function FeedPreview({ view }: { view: LeagueView }) {
  const items = view.feed.slice(0, 5);
  return (
    <Section
      title="Feed"
      right={
        <Text style={[T.small, { color: C.gold, fontWeight: '800' }]} onPress={() => router.push(`/league/${view.id}/feed`)}>
          Vedi tutto ›
        </Text>
      }>
      <Card onPress={() => router.push(`/league/${view.id}/feed`)}>
        {items.length === 0 ? (
          <Text style={T.small}>Ancora silenzio... il bello deve ancora venire 🔥</Text>
        ) : (
          items.map((f, i) => (
            <Row key={f.id} gap={S.md} style={[{ alignItems: 'flex-start' }, i > 0 && { marginTop: S.md }]}>
              <Text style={{ fontSize: 18 }}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={T.body} numberOfLines={2}>
                  {f.text}
                </Text>
                <Text style={[T.small, { fontSize: 11 }]}>{timeAgo(f.at, view.serverNow)}</Text>
              </View>
            </Row>
          ))
        )}
      </Card>
    </Section>
  );
}

export function SettingsSummary({ view }: { view: LeagueView }) {
  const c = view.config;
  const tone = TONE_IT[c.commentaryTone];
  const vis = [c.visibility.othersCredits ? 'crediti visibili' : 'crediti nascosti', c.visibility.othersRosters ? 'rose visibili' : 'rose nascoste', c.visibility.bidderNames ? 'offerenti visibili' : 'asta al buio 🕶️'];
  const rows: [string, string][] = [
    ['Crediti iniziali', `${c.startingCredits}`],
    ['Rosa', rosterSummary(c)],
    ['Timer asta', `${c.bidTimerSeconds}s · apertura ${c.openingTimerSeconds}s`],
    ['Offerte', `min ${c.minPrice} · +${c.minIncrement}`],
    ['Invenduti', c.unsoldPolicy === 'requeue' ? 'rimessi nel pool' : 'scartati'],
    ['Formato', `${FORMAT_IT[c.format]}${c.playoffs ? ` · playoff a ${c.playoffTeams}` : ''}${c.homeAway ? ' · casa/trasf.' : ''}`],
    ['Telecronaca', `${tone.emoji} ${tone.label}`],
    ['Partita live', `${c.liveMatchSeconds}s`],
    ['Visibilità', vis.join(' · ')],
  ];
  return (
    <Section title="Regole della lega">
      <Card>
        {rows.map(([k, v]) => (
          <Row key={k} style={styles.kv}>
            <Text style={[T.small, { width: 110 }]}>{k}</Text>
            <Text style={[T.body, { flex: 1, textAlign: 'right' }]}>{v}</Text>
          </Row>
        ))}
        {c.customRules.trim() ? (
          <>
            <Divider />
            <Text style={T.tiny}>Regole personalizzate</Text>
            <Text style={[T.body, { marginTop: S.xs }]}>{c.customRules}</Text>
          </>
        ) : null}
      </Card>
    </Section>
  );
}

export function PoolSummary({ view, onPress }: { view: LeagueView; onPress?: () => void }) {
  const counts = useMemo(() => {
    const out: Record<Slot, number> = { GK: 0, DF: 0, MF: 0, FW: 0, COACH: 0 };
    for (const i of eligibleItems(view.config, view.customItems)) out[Catalog.slotOf(i)]++;
    return out;
  }, [view.config, view.customItems]);
  const teams = Math.max(view.teams.length, 2);
  const need = (s: Slot) => (s === 'COACH' ? (view.config.roster.coach ? 1 : 0) : view.config.roster[s]) * teams;
  const total = SLOTS.reduce((s, k) => s + counts[k], 0);

  return (
    <Section title={`Pool · ${total} disponibili`}>
      <Card onPress={onPress}>
        <Row style={{ justifyContent: 'space-between' }}>
          {SLOTS.map((s) => {
            const n = need(s);
            const short = n > 0 && counts[s] < n;
            return (
              <View key={s} style={styles.poolCell}>
                <Text style={[styles.poolSlot, { color: SLOT_COLORS[s] }]}>{SLOT_SHORT[s]}</Text>
                <Text style={[T.h2, T.number, short && { color: C.red }]}>{counts[s]}</Text>
                <Text style={[T.small, { fontSize: 10 }]}>{n > 0 ? `min ${n}` : '—'}</Text>
              </View>
            );
          })}
        </Row>
        {SLOTS.some((s) => need(s) > 0 && counts[s] < need(s)) ? (
          <Text style={[T.small, { color: C.red, marginTop: S.sm }]}>⚠️ Pool troppo piccolo per alcuni ruoli: aggiungi giocatori o cambia preset.</Text>
        ) : null}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  teamRow: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: S.md, borderRadius: 0 },
  sep: { height: 1, backgroundColor: C.border },
  chev: { color: C.textMute, fontSize: 22, marginLeft: 2 },
  kv: { paddingVertical: 6, alignItems: 'flex-start' },
  poolCell: { alignItems: 'center', flex: 1, paddingVertical: S.xs, borderRadius: R.sm },
  poolSlot: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
});
