import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useScreenAwake } from '@/lib/hooks/useScreenAwake';
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Catalog, missingLabels, SLOTS, type DomainEvent, type Slot } from '@asta/core';
import { Avatar, Button, Card, EmptyState, OvrBadge, Pill, Row, Screen, Section, SlotBadge, TeamBadge } from '@/components/ui';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { useConnection, useLeague, useTicker } from '@/lib/hooks/useLeague';
import { C, R, S, SLOT_COLORS, T } from '@/lib/theme';
import { SLOT_SHORT, newBidId, shortName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sfx';
import { LotCard } from './LotCard';
import { BidPad } from './BidPad';
import { TimerRing } from './TimerRing';
import { SoldOverlay } from './SoldOverlay';

const REASONS: Record<string, string> = {
  leading: 'Sei il miglior offerente 👑',
  roleFull: 'Hai già completato questo ruolo',
  rosterFull: 'La tua rosa è completa ✅',
  paused: 'Asta in pausa',
  noCredits: 'Crediti insufficienti per rilanciare',
};

/**
 * LIVE AUCTION. Everything shown here comes from the authoritative snapshot;
 * the countdown is computed against the server clock, so every phone shows the
 * same second.
 */
export function AuctionScreen({ leagueId }: { leagueId: string }) {
  useScreenAwake('auction');
  const [flash, setFlash] = useState<{ key: number; text: string; from: number; to: number } | null>(null);
  const [pending, setPending] = useState(false);
  const bump = useSharedValue(1);
  const league = useLeague(leagueId, (events) => onEvents(events));
  const { view, catalog, myTeam, isMaster, run, serverNow } = league;
  const connection = useConnection(leagueId);
  const status = view?.auction.status;
  useTicker(100, status === 'lot_open');

  const teamName = (id: string | null) => view?.teams.find((t) => t.id === id)?.name ?? null;
  const ownerOf = (id: string | null) => view?.members.find((m) => m.teamId === id) ?? null;

  const latestView = useRef(view);
  latestView.current = view;
  function onEvents(events: DomainEvent[]) {
    const v = latestView.current;
    const myTeamId = v?.members.find((m) => m.userId === v.viewerId)?.teamId;
    for (const e of events) {
      if (e.type === 'BidPlaced') sfx.play(e.teamId === myTeamId ? 'bid_mine' : 'bid');
      if (e.type === 'Outbid' && e.teamId === myTeamId) sfx.play('outbid');
      if (e.type === 'PlayerSold' && !e.result.autoAssigned) sfx.play(e.result.teamId === myTeamId ? 'sold_mine' : 'sold');
      if (e.type === 'LotUnsold') sfx.play('unsold');
      if (e.type === 'LotOpened') sfx.play('lot_open');
      if (e.type === 'BidPlaced') {
        bump.value = withSequence(withTiming(1.18, { duration: 90 }), withTiming(1, { duration: 220 }));
        const who = e.teamId ? (v?.members.find((m) => m.teamId === e.teamId)?.displayName ?? 'Qualcuno') : 'Qualcuno';
        setFlash({ key: Date.now(), text: `${who.toUpperCase()} RILANCIA!`, from: e.previousAmount, to: e.amount });
        if (e.teamId !== v?.members.find((m) => m.userId === v.viewerId)?.teamId) haptic.tap();
      }
      if (e.type === 'PlayerSold' && e.result.teamId && e.result.teamId === v?.members.find((m) => m.userId === v.viewerId)?.teamId) haptic.success();
      if (e.type === 'LotOpened') haptic.heavy();
    }
  }
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const lot = view?.auction.currentLot ?? null;
  const item = lot ? catalog.find(lot.itemId) : null;
  const remainingMs = !lot ? 0 : status === 'paused' ? (view?.auction.pausedRemainingMs ?? 0) : Math.max(0, lot.endsAt - serverNow());
  const totalMs = lot ? (lot.bids.length ? view!.config.bidTimerSeconds : view!.config.openingTimerSeconds) * 1000 : 1;

  // clock ticks in the last 3 seconds of a lot
  const tickSecond = status === 'lot_open' && remainingMs > 0 && remainingMs <= 3000 ? Math.ceil(remainingMs / 1000) : null;
  useEffect(() => {
    if (tickSecond !== null) sfx.play('tick');
  }, [tickSecond, lot?.id, lot?.bids.length]);

  const mine = myTeam;
  const myMax = mine?.maxBid ?? 0;
  const disabledReason = useMemo(() => {
    if (!lot || !mine) return null;
    if (status === 'paused') return REASONS.paused;
    if (Object.values(mine.needs).every((n) => n === 0)) return REASONS.rosterFull;
    if (mine.needs[lot.slot] === 0) return REASONS.roleFull;
    if (lot.leaderTeamId === mine.id) return REASONS.leading;
    if (lot.minNextBid > myMax) return REASONS.noCredits;
    return null;
  }, [lot, mine, status, myMax]);

  if (!view) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  if (view.status === 'lobby') {
    return (
      <Screen>
        <EmptyState emoji="⏳" title="L'asta non è ancora iniziata" body="Il Master avvierà l'asta quando tutti saranno pronti." action={<Button label="VAI ALLA LOBBY" variant="gold" onPress={() => router.push(`/league/${leagueId}`)} />} />
      </Screen>
    );
  }

  if (view.status !== 'auction') {
    return <AuctionRecap leagueId={leagueId} />;
  }

  const bid = async (amount: number) => {
    if (!lot) return;
    setPending(true);
    try {
      await run('auction:bid', { lotId: lot.id, amount, bidId: newBidId() });
    } catch {
      haptic.error();
    } finally {
      setPending(false);
    }
  };

  const leader = lot?.leaderTeamId ? view.teams.find((t) => t.id === lot.leaderTeamId) : null;
  const iLead = !!lot && lot.leaderTeamId === mine?.id;
  const showSold = status === 'lot_sold' && view.auction.lastResult;
  const soldItem = showSold ? catalog.find(view.auction.lastResult!.itemId) : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen>
        <ConnectionBanner status={connection} />
        <Row style={{ justifyContent: 'space-between', marginBottom: S.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[T.tiny, { color: C.gold }]}>ASTA LIVE · {view.config.name}</Text>
            <Text style={T.small}>
              {view.auction.remainingTotal} elementi rimasti · {SLOTS.filter((s) => view.auction.remaining[s] > 0).map((s) => `${view.auction.remaining[s]} ${SLOT_SHORT[s]}`).join(' · ')}
            </Text>
          </View>
          {isMaster ? (
            <Button small variant="dark" label={status === 'paused' ? '▶ Riprendi' : '⏸ Pausa'} onPress={() => run(status === 'paused' ? 'auction:resume' : 'auction:pause', {})} />
          ) : null}
        </Row>

        {lot && item ? (
          <>
            <LotCard item={item} lotNumber={lot.number} />
            <Card style={{ marginTop: S.md }} highlight={iLead}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={T.tiny}>OFFERTA</Text>
                  <Animated.Text style={[styles.bigBid, bumpStyle, { color: iLead ? C.green : C.gold }]}>{lot.currentBid || '—'}</Animated.Text>
                  <Text style={[T.h3, { color: iLead ? C.green : C.text }]} numberOfLines={1}>
                    {leader ? `${iLead ? '👑 ' : ''}${ownerOf(leader.id)?.displayName ?? leader.name}` : lot.leaderHidden ? '🕶️ Offerente nascosto' : `Base d'asta: ${lot.minNextBid}`}
                  </Text>
                  {leader ? <Text style={T.small}>{leader.name}</Text> : null}
                </View>
                <TimerRing remainingMs={remainingMs} totalMs={totalMs} paused={status === 'paused'} size={104} />
              </Row>
              {/* fixed-height slot: the rilancio banner never shifts the bid buttons under the user's finger */}
              <View style={styles.flashSlot}>
                {flash ? (
                  <Animated.View key={flash.key} entering={FadeInDown.springify()} exiting={FadeOut} style={styles.flash}>
                    <Text style={styles.flashText} numberOfLines={1}>
                      {flash.from > 0 ? `${flash.from} → ${flash.to}` : `${flash.to}`} · {flash.text}
                    </Text>
                  </Animated.View>
                ) : null}
              </View>
            </Card>

            <View style={{ marginTop: S.md }}>
              <BidPad currentBid={lot.currentBid} hasLeader={!!lot.leaderTeamId || lot.leaderHidden} minNextBid={lot.minNextBid} maxBid={myMax} disabledReason={disabledReason} pending={pending} onBid={bid} />
            </View>

            {lot.bids.length ? (
              <Section title="Storico offerte">
                <Card style={{ paddingVertical: S.sm }}>
                  {[...lot.bids].reverse().slice(0, 6).map((b, i) => (
                    <Row key={b.id} style={styles.bidRow}>
                      <Text style={[T.body, { flex: 1, color: i === 0 ? C.text : C.textDim, fontWeight: i === 0 ? '900' : '600' }]}>{b.teamId ? (ownerOf(b.teamId)?.displayName ?? teamName(b.teamId)) : '🕶️ ???'}</Text>
                      <Text style={[T.h3, T.number, { color: i === 0 ? C.gold : C.textDim }]}>{b.amount}</Text>
                    </Row>
                  ))}
                </Card>
              </Section>
            ) : null}
          </>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: S.xxl }}>
            <ActivityIndicator color={C.gold} />
            <Text style={[T.small, { marginTop: S.md }]}>{status === 'paused' ? 'Asta in pausa' : 'Estrazione del prossimo lotto…'}</Text>
          </Card>
        )}

        {mine ? <MyRosterPanel team={mine} catalog={catalog} /> : null}

        <Section title="Avversari">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }}>
            {view.teams
              .filter((t) => t.id !== mine?.id)
              .map((t) => {
                const owner = ownerOf(t.id);
                const leading = lot?.leaderTeamId === t.id;
                return (
                  <View key={t.id} style={[styles.rival, leading && { borderColor: C.gold }]}>
                    <Row>
                      <Avatar emoji={owner?.avatar ?? '⚽'} size={28} online={owner?.connected} />
                      <Text style={[T.h3, { flex: 1 }]} numberOfLines={1}>
                        {owner?.displayName}
                      </Text>
                    </Row>
                    <Text style={[T.small, { marginTop: 4 }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={[T.h3, T.number, { color: C.gold }]}>{t.credits ?? '🔒'}</Text>
                      <Text style={[T.small, T.number]}>
                        {t.rosterCount}/{t.rosterCount + Object.values(t.needs).reduce((s, n) => s + n, 0)}
                      </Text>
                    </Row>
                    {leading ? <Pill label="IN TESTA" color={C.gold} solid /> : null}
                  </View>
                );
              })}
          </ScrollView>
        </Section>

        {view.auction.results.some((r) => r.teamId || r.price) ? (
          <Section title="Acquisti">
            <Card style={{ paddingVertical: S.xs }}>
              {[...view.auction.results]
                .filter((r) => r.teamId || r.price)
                .reverse()
                .slice(0, 12)
                .map((r) => {
                  const it = catalog.find(r.itemId);
                  return (
                    <Row key={`${r.lotId}-${r.closedAt}`} style={styles.bidRow}>
                      <SlotBadge slot={r.slot} />
                      <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>
                        {it?.name} <Text style={T.small}>→ {teamName(r.teamId) ?? '???'}</Text>
                      </Text>
                      <Text style={[T.h3, T.number, { color: C.gold }]}>{r.price}</Text>
                    </Row>
                  );
                })}
            </Card>
          </Section>
        ) : null}
      </Screen>
      {showSold && soldItem ? (
        <SoldOverlay
          result={view.auction.lastResult!}
          item={soldItem}
          teamName={teamName(view.auction.lastResult!.teamId)}
          logo={view.teams.find((t) => t.id === view.auction.lastResult!.teamId)?.logo ?? null}
          mine={view.auction.lastResult!.teamId === mine?.id}
        />
      ) : null}
    </View>
  );
}

/** "I MIEI CREDITI / LA MIA ROSA / MANCANO" strategy panel. */
function MyRosterPanel({ team, catalog }: { team: NonNullable<ReturnType<typeof useLeague>['myTeam']>; catalog: Catalog }) {
  const roster = team.roster ?? [];
  const slots: { slot: Slot; entry: (typeof roster)[number] | null }[] = [];
  for (const slot of SLOTS) {
    const owned = roster.filter((r) => r.slot === slot);
    for (const e of owned) slots.push({ slot, entry: e });
    for (let i = 0; i < team.needs[slot]; i++) slots.push({ slot, entry: null });
  }
  const missing = missingLabels(team.needs);
  return (
    <Section title="La mia squadra">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={T.tiny}>I miei crediti</Text>
            <Text style={[styles.credits]}>{team.credits}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={T.tiny}>Offerta max</Text>
            <Text style={[T.h1, T.number, { color: C.text }]}>{team.maxBid}</Text>
          </View>
        </Row>
        <View style={{ marginTop: S.md, gap: 6 }}>
          {slots.map(({ slot, entry }, i) => {
            const it = entry ? catalog.find(entry.itemId) : null;
            return (
              <Row key={`${slot}-${i}`} style={[styles.slotRow, !entry && { opacity: 0.55 }]}>
                <SlotBadge slot={slot} />
                <Text style={[T.body, { flex: 1, fontWeight: entry ? '800' : '600', color: entry ? C.text : C.textMute }]} numberOfLines={1}>
                  {it ? shortName(it.name).toUpperCase() : '???'}
                </Text>
                {it ? <OvrBadge value={it.overall} rarity={it.rarity} size="sm" /> : null}
                <Text style={[T.h3, T.number, { width: 36, textAlign: 'right', color: entry ? C.gold : C.textMute }]}>{entry ? entry.price : '—'}</Text>
              </Row>
            );
          })}
        </View>
        {missing.length ? (
          <View style={{ marginTop: S.md }}>
            <Text style={T.tiny}>Mancano</Text>
            <Row style={{ flexWrap: 'wrap', marginTop: 6 }} gap={6}>
              {missing.map((m) => (
                <Pill key={m} label={m} color={C.orange} />
              ))}
            </Row>
          </View>
        ) : (
          <Text style={[T.h3, { color: C.green, marginTop: S.md }]}>✅ Rosa completa!</Text>
        )}
      </Card>
    </Section>
  );
}

function AuctionRecap({ leagueId }: { leagueId: string }) {
  const { view, catalog } = useLeague(leagueId);
  if (!view) return null;
  const priciest = [...view.auction.results].filter((r) => r.teamId).sort((a, b) => b.price - a.price).slice(0, 5);
  return (
    <Screen>
      <Text style={[T.tiny, { color: C.gold }]}>{view.config.name}</Text>
      <Text style={T.h1}>ASTA CONCLUSA 🏁</Text>
      <Text style={[T.small, { marginBottom: S.lg }]}>Tutte le rose sono complete. Ora si fa sul serio.</Text>
      <Section title="Le rose">
        {view.teams.map((t) => (
          <Card key={t.id} style={{ marginBottom: S.sm }} onPress={() => router.push(`/league/${leagueId}/team/${t.id}`)}>
            <Row>
              <TeamBadge logo={t.logo} />
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>{t.name}</Text>
                <Text style={T.small} numberOfLines={1}>
                  {(t.roster ?? []).map((r) => shortName(catalog.find(r.itemId)?.name ?? '')).join(' · ')}
                </Text>
              </View>
              <Text style={[T.h3, T.number, { color: C.gold }]}>{t.credits ?? '🔒'}</Text>
            </Row>
          </Card>
        ))}
      </Section>
      <Section title="Gli acquisti più cari">
        <Card>
          {priciest.map((r) => (
            <Row key={r.lotId} style={styles.bidRow}>
              <View style={[styles.dot, { backgroundColor: SLOT_COLORS[r.slot] }]} />
              <Text style={[T.body, { flex: 1 }]}>{catalog.find(r.itemId)?.name}</Text>
              <Text style={[T.h3, T.number, { color: C.gold }]}>{r.price}</Text>
            </Row>
          ))}
        </Card>
      </Section>
      <Button label="VAI ALLA LEGA" variant="gold" style={{ marginTop: S.xl }} onPress={() => router.push(`/league/${leagueId}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bigBid: { fontSize: 64, fontWeight: '900', letterSpacing: -2, ...T.number },
  flashSlot: { height: 40, marginTop: S.md, justifyContent: 'center' },
  flash: { position: 'absolute', left: 0, right: 0, backgroundColor: `${C.gold}22`, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: S.md, borderWidth: 1, borderColor: C.gold },
  flashText: { color: C.goldBright, fontWeight: '900', fontSize: 15, textAlign: 'center', letterSpacing: 0.5 },
  bidRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  rival: { width: 150, backgroundColor: C.card, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.border, gap: 2 },
  credits: { fontSize: 44, fontWeight: '900', color: C.gold, ...T.number },
  slotRow: { backgroundColor: C.bgElevated, borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
