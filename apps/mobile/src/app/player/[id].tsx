import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { attributeGroups, type Coach, type CoachModifiers, type Foot, type LeagueView, type Player, type Rarity } from '@asta/core';
import { useLeague } from '@/lib/hooks/useLeague';
import { C, R, RARITY_COLORS, S, SLOT_COLORS, T } from '@/lib/theme';
import { POSITION_IT, SLOT_SHORT, STYLE_IT, TACTIC_IT } from '@/lib/format';
import { Card, EmptyState, Pill, Row, Screen, Section, StatBar, TeamBadge } from '@/components/ui';
import { MODIFIER_IT } from '@/components/season/shared';

const RARITY_IT: Record<Rarity, string> = { common: 'Comune', rare: 'Raro', epic: 'Epico', legendary: 'Leggenda' };
const FOOT_IT: Record<Foot, string> = { L: 'Sinistro', R: 'Destro', B: 'Ambidestro' };

const stars = (n: number) => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));

function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

interface Ownership {
  teamId: string;
  name: string;
  logo: LeagueView['teams'][number]['logo'];
  price: number;
  autoAssigned: boolean;
}

function findOwnership(view: LeagueView | null, itemId: string): Ownership | null {
  if (!view) return null;
  for (const t of view.teams) {
    const e = t.roster?.find((r) => r.itemId === itemId);
    if (e) return { teamId: t.id, name: t.name, logo: t.logo, price: e.price, autoAssigned: e.autoAssigned };
  }
  const res = view.auction.results.find((r) => r.itemId === itemId && r.teamId);
  const team = res ? view.teams.find((t) => t.id === res.teamId) : undefined;
  if (res && team) return { teamId: team.id, name: team.name, logo: team.logo, price: res.price, autoAssigned: res.autoAssigned };
  return null;
}

export default function PlayerCardScreen() {
  const params = useLocalSearchParams<{ id: string; league?: string }>();
  const id = param(params.id) ?? '';
  const leagueId = param(params.league);
  // with no league the hook stays idle and its catalog is the plain seed catalog
  const { view, catalog } = useLeague(leagueId);
  const waiting = !!leagueId && !view;
  const item = useMemo(() => catalog.find(id), [catalog, id]);
  const owner = useMemo(() => findOwnership(view, id), [view, id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityLabel="Chiudi">
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>✕</Text>
        </Pressable>
      </Row>
      {!item ? (
        waiting ? (
          <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 80 }} />
        ) : (
          <EmptyState emoji="👻" title="Giocatore non trovato" body="Questa leggenda sembra essere sparita dagli archivi." />
        )
      ) : item.kind === 'player' ? (
        <PlayerView player={item} owner={owner} leagueId={leagueId} />
      ) : (
        <CoachView coach={item} owner={owner} leagueId={leagueId} />
      )}
    </Screen>
  );
}

// ───────────────────────────── shared bits

function CardShell({ rarity, children }: { rarity: Rarity; children: React.ReactNode }) {
  const color = RARITY_COLORS[rarity];
  return (
    <View style={[styles.glowWrap, { shadowColor: color }]}>
      <LinearGradient colors={[`${color}55`, '#0E1830', '#070B14']} locations={[0, 0.45, 1]} style={[styles.card, { borderColor: color }]}>
        <View style={[styles.stripe, { backgroundColor: `${color}18` }]} />
        {children}
      </LinearGradient>
    </View>
  );
}

function OwnerCard({ owner, leagueId }: { owner: Ownership | null; leagueId?: string }) {
  if (!leagueId) return null;
  if (!owner) {
    return (
      <Card style={{ marginTop: S.lg }}>
        <Text style={T.small}>🆓 Svincolato in questa lega: nessuno se l’è (ancora) aggiudicato.</Text>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: S.lg }} onPress={() => router.push(`/league/${leagueId}/team/${owner.teamId}`)}>
      <Row gap={S.md}>
        <TeamBadge logo={owner.logo} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={T.tiny}>Proprietario</Text>
          <Text style={T.h3} numberOfLines={1}>
            {owner.name}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <Text style={[T.h2, T.number, { color: C.gold }]}>{owner.price} cr</Text>
          {owner.autoAssigned ? <Pill label="d'ufficio" color={C.textDim} /> : null}
        </View>
      </Row>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={[T.tiny, { letterSpacing: 0.4 }]}>{label}</Text>
      <Text style={[T.body, { fontWeight: '800', marginTop: 2 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ───────────────────────────── player

function PlayerView({ player, owner, leagueId }: { player: Player; owner: Ownership | null; leagueId?: string }) {
  const color = RARITY_COLORS[player.rarity];
  const groups = attributeGroups(player);
  return (
    <View>
      <CardShell rarity={player.rarity}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ alignItems: 'center', width: 76 }}>
            <Text style={[styles.ovr, { color }]}>{player.overall}</Text>
            <Text style={[styles.pos, { color: SLOT_COLORS[player.position] }]}>{SLOT_SHORT[player.position]}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 6 }}>
            <Pill label={RARITY_IT[player.rarity].toUpperCase()} color={color} solid={player.rarity === 'legendary'} />
            {player.source !== 'catalog' ? <Pill label={player.source === 'ai' ? '✨ AI' : '🛠️ CUSTOM'} color={C.purple} /> : null}
          </View>
        </Row>
        <Text style={styles.name} numberOfLines={2}>
          {player.name}
        </Text>
        <Text style={[T.small, { textAlign: 'center', color: C.text }]}>
          {player.nationality} · {POSITION_IT[player.position]}
        </Text>
        <Text style={[styles.prime, { color }]}>PRIME {player.primePeriod}</Text>
        <Text style={[T.small, { textAlign: 'center' }]}>🏟️ {player.historicalClub}</Text>
        <View style={[styles.divider, { backgroundColor: `${color}55` }]} />
        <View style={styles.infoGrid}>
          <Info label="Stile" value={STYLE_IT[player.playStyle]} />
          <Info label="Piede" value={FOOT_IT[player.foot]} />
          <Info label="Altezza" value={`${player.heightCm} cm`} />
          <Info label="Piede debole" value={stars(player.weakFoot)} />
          <Info label="Skill" value={stars(player.skillMoves)} />
          <Info label="Valore base" value={`${player.baseAuctionValue} cr`} />
        </View>
      </CardShell>

      <OwnerCard owner={owner} leagueId={leagueId} />

      {groups.map((g) => (
        <Section key={g.label} title={g.label}>
          <Card>
            {g.items.map((a) => (
              <StatBar key={a.label} label={a.label} value={a.value} color={color} />
            ))}
          </Card>
        </Section>
      ))}

      {player.tags.length ? (
        <Section title="Tag">
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            {player.tags.map((t) => (
              <Pill key={t} label={t} color={C.textDim} />
            ))}
          </Row>
        </Section>
      ) : null}
    </View>
  );
}

// ───────────────────────────── coach

const MOD_MIN = -5;
const MOD_MAX = 12;

function ModifierBar({ label, value }: { label: string; value: number }) {
  const span = MOD_MAX - MOD_MIN;
  const zero = (-MOD_MIN / span) * 100;
  const clamped = Math.max(MOD_MIN, Math.min(MOD_MAX, value));
  const width = (Math.abs(clamped) / span) * 100;
  const c = value > 0 ? C.green : value < 0 ? C.red : C.textMute;
  return (
    <View style={{ marginBottom: 10 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={T.small}>{label}</Text>
        <Text style={[T.small, T.number, { color: c, fontWeight: '900' }]}>{value > 0 ? `+${value}` : value}</Text>
      </Row>
      <View style={styles.modTrack}>
        <View style={[styles.modZero, { left: `${zero}%` }]} />
        <View style={[styles.modFill, { backgroundColor: c, width: `${width}%`, left: clamped >= 0 ? `${zero}%` : `${zero - width}%` }]} />
      </View>
    </View>
  );
}

function CoachView({ coach, owner, leagueId }: { coach: Coach; owner: Ownership | null; leagueId?: string }) {
  const color = RARITY_COLORS[coach.rarity];
  const keys = Object.keys(MODIFIER_IT) as (keyof CoachModifiers)[];
  return (
    <View>
      <CardShell rarity={coach.rarity}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ alignItems: 'center', width: 76 }}>
            <Text style={[styles.ovr, { color }]}>{coach.overall}</Text>
            <Text style={[styles.pos, { color: SLOT_COLORS.COACH }]}>{SLOT_SHORT.COACH}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 6 }}>
            <Pill label={RARITY_IT[coach.rarity].toUpperCase()} color={color} solid={coach.rarity === 'legendary'} />
            {coach.source !== 'catalog' ? <Pill label={coach.source === 'ai' ? '✨ AI' : '🛠️ CUSTOM'} color={C.purple} /> : null}
          </View>
        </Row>
        <Text style={{ fontSize: 44, textAlign: 'center', marginTop: S.sm }}>📋</Text>
        <Text style={styles.name} numberOfLines={2}>
          {coach.name}
        </Text>
        <Text style={[T.small, { textAlign: 'center', color: C.text }]}>{coach.nationality} · Allenatore</Text>
        <Text style={[styles.prime, { color }]}>PRIME {coach.primePeriod}</Text>
        <View style={[styles.divider, { backgroundColor: `${color}55` }]} />
        <Text style={[T.body, { textAlign: 'center', fontStyle: 'italic' }]}>“{coach.style}”</Text>
        <View style={[styles.infoGrid, { marginTop: S.md }]}>
          <Info label="Tattica preferita" value={TACTIC_IT[coach.preferredTactic]} />
          <Info label="Valore base" value={`${coach.baseAuctionValue} cr`} />
        </View>
      </CardShell>

      <OwnerCard owner={owner} leagueId={leagueId} />

      <Section title="Modificatori di squadra" right={<Text style={T.small}>scala −5 … +12</Text>}>
        <Card>
          {keys.map((k) => (
            <ModifierBar key={k} label={MODIFIER_IT[k]} value={coach.modifiers[k]} />
          ))}
        </Card>
      </Section>

      {coach.tags.length ? (
        <Section title="Tag">
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            {coach.tags.map((t) => (
              <Pill key={t} label={t} color={C.textDim} />
            ))}
          </Row>
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.cardHigh, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  glowWrap: { marginTop: S.sm, borderRadius: R.lg + 4, shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12, width: '100%', maxWidth: 380, alignSelf: 'center' },
  card: { borderRadius: R.lg + 4, borderWidth: 2, padding: S.lg, overflow: 'hidden' },
  stripe: { position: 'absolute', top: -40, right: -60, width: 180, height: 420, transform: [{ rotate: '24deg' }] },
  ovr: { fontSize: 54, fontWeight: '900', letterSpacing: -2, lineHeight: 58, ...T.number },
  pos: { fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  name: { ...T.h1, textAlign: 'center', marginTop: S.md, textTransform: 'uppercase' },
  prime: { textAlign: 'center', fontWeight: '900', letterSpacing: 2, fontSize: 12, marginVertical: 6 },
  divider: { height: 1, marginVertical: S.md },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: S.md },
  info: { width: '33.33%', alignItems: 'center', paddingHorizontal: 2 },
  modTrack: { height: 8, borderRadius: 4, backgroundColor: C.bgElevated, overflow: 'hidden' },
  modZero: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: C.textMute },
  modFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4 },
});
