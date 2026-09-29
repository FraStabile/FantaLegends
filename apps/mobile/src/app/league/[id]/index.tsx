import React, { useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { BOT_PROFILES, type BotArchetype, type LeagueView } from '@asta/core';
import { C, R, S, T } from '@/lib/theme';
import { useLeague, type LeagueHandle } from '@/lib/hooks/useLeague';
import { isLocalLeague, useSession } from '@/lib/store/session';
import { toast } from '@/lib/store/toasts';
import { haptic } from '@/lib/haptics';
import { getRandomBots } from '@/lib/demo';
import { Avatar, Button, Card, EmptyState, Header, Pill, Row, Screen, Section, TeamBadge } from '@/components/ui';
import { statusInfo } from '@/components/league/labels';
import { FeedPreview, PoolSummary, SettingsSummary, TeamsList, rosterValue } from '@/components/league/HubSections';

const ARCHETYPES = Object.keys(BOT_PROFILES) as BotArchetype[];

function canStart(view: LeagueView): { ok: boolean; reason?: string } {
  if (view.status !== 'lobby') return { ok: false, reason: 'La lega non è in lobby' };
  if (view.members.length < 2) return { ok: false, reason: 'Servono almeno 2 partecipanti: invita un amico o aggiungi un bot' };
  const waiting = view.members.filter((m) => !m.isMaster && !m.ready);
  if (waiting.length) return { ok: false, reason: `In attesa che siano pronti: ${waiting.map((m) => m.displayName).join(', ')}` };
  return { ok: true };
}

function goSeason(id: string) {
  useSession.getState().setActiveLeague(id);
  router.push('/(tabs)/season');
}

export default function LeagueHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const league = useLeague(id);
  const { view, error } = league;

  if (!view) {
    return (
      <Screen scroll={false}>
        <Row style={{ marginBottom: S.sm }}>
          <Button small variant="ghost" label="‹ Indietro" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/leagues'))} />
        </Row>
        {error ? (
          <EmptyState emoji="📡" title="Lega non disponibile" body={error} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={C.gold} size="large" />
            <Text style={[T.small, { marginTop: S.md }]}>Caricamento lega...</Text>
          </View>
        )}
      </Screen>
    );
  }

  const st = statusInfo(view.status);

  return (
    <Screen>
      <Row style={{ marginBottom: S.sm, justifyContent: 'space-between' }}>
        <Button small variant="ghost" label="‹ Leghe" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/leagues'))} />
        <Row gap={6}>
          {isLocalLeague(view.id) ? <Pill label="DEMO" color={C.purple} solid /> : <Pill label={view.code} color={C.gold} />}
          <Pill label={`${st.emoji} ${st.label.toUpperCase()}`} color={st.color} />
        </Row>
      </Row>
      <Header kicker={`Stagione ${view.season}`} title={view.config.name} subtitle={`${view.members.length}/${view.config.maxParticipants} partecipanti${league.isMaster ? ' · sei il Master 👑' : ''}`} />

      {view.status === 'lobby' ? <Lobby league={league} view={view} /> : null}
      {view.status === 'auction' ? <AuctionLive view={view} /> : null}
      {view.status === 'pre_season' ? <PreSeason league={league} view={view} /> : null}
      {view.status === 'season' || view.status === 'completed' ? <SeasonBlock league={league} view={view} /> : null}

      <TeamsList view={view} />
      <FeedPreview view={view} />
    </Screen>
  );
}

// ───────────────────────────── lobby

function Lobby({ league, view }: { league: LeagueHandle; view: LeagueView }) {
  const { run, isMaster, me } = league;
  const [busy, setBusy] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<string | null>(null);
  const local = isLocalLeague(view.id);
  const check = canStart(view);
  const full = view.members.length >= view.config.maxParticipants;

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      // toast already shown by run()
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(view.code);
    haptic.success();
    toast.success('Codice copiato!', view.code);
  };

  const share = async () => {
    const link = `astalegends://join/${view.code}`;
    const message = `🏆 Entra nella mia lega "${view.config.name}" su Asta Legends!\nCodice: ${view.code}\n${link}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
        await Clipboard.setStringAsync(message);
        toast.success('Invito copiato negli appunti');
        return;
      }
      await Share.share({ message, title: 'Invito Asta Legends' });
    } catch {
      /* dismissed */
    }
  };

  const start = () =>
    act('start', async () => {
      await run('auction:start', {});
      haptic.heavy();
      router.push(`/league/${view.id}/auction`);
    });

  return (
    <View>
      {!local ? (
        <Card highlight style={{ marginTop: S.lg, alignItems: 'center' }}>
          <Text style={T.tiny}>Codice invito</Text>
          <Text style={[styles.bigCode, T.number]} selectable>
            {view.code}
          </Text>
          <View style={styles.qr}>
            <QRCode value={`astalegends://join/${view.code}`} size={168} backgroundColor={C.card} color={C.text} />
          </View>
          <Row style={{ marginTop: S.lg, alignSelf: 'stretch' }}>
            <Button small variant="dark" icon="📋" label="Copia codice" style={{ flex: 1 }} onPress={() => void copy()} />
            <Button small variant="gold" icon="📤" label="Condividi" style={{ flex: 1 }} onPress={() => void share()} />
          </Row>
        </Card>
      ) : (
        <Card style={{ marginTop: S.lg, borderColor: C.purple }}>
          <Text style={T.h3}>🤖 Lega demo</Text>
          <Text style={T.small}>Questa lega vive sul tuo dispositivo: aggiungi i bot come avversari e parti con l'asta.</Text>
        </Card>
      )}

      <Section title={`Partecipanti · ${view.members.length}/${view.config.maxParticipants}`}>
        <Card style={{ paddingVertical: S.sm }}>
          {view.members.map((m, i) => {
            const team = view.teams.find((t) => t.id === m.teamId);
            const isMe = m.userId === view.viewerId;
            return (
              <View key={m.userId} style={[styles.member, i > 0 && styles.memberSep]}>
                <Avatar emoji={m.avatar} size={40} online={m.connected} />
                <View style={{ flex: 1 }}>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Text style={[T.h3, isMe && { color: C.gold }]} numberOfLines={1}>
                      {m.displayName}
                      {isMe ? ' (tu)' : ''}
                    </Text>
                    {m.isMaster ? <Pill label="MASTER" solid /> : null}
                    {m.bot ? <Pill label={`${BOT_PROFILES[m.bot].emoji} ${BOT_PROFILES[m.bot].label.toUpperCase()}`} color={C.purple} /> : null}
                  </Row>
                  {team ? (
                    <Row gap={6} style={{ marginTop: 3 }}>
                      <TeamBadge logo={team.logo} size={20} />
                      <Text style={T.small} numberOfLines={1}>
                        {team.name}
                      </Text>
                    </Row>
                  ) : null}
                </View>
                <Text style={{ fontSize: 18 }}>{m.isMaster || m.ready ? '✅' : '⏳'}</Text>
                {isMaster && !m.isMaster ? (
                  kickTarget === m.userId ? (
                    <Button
                      small
                      variant="danger"
                      label="Conferma"
                      loading={busy === `kick-${m.userId}`}
                      onPress={() => void act(`kick-${m.userId}`, async () => {
                        await run('lobby:kick', { userId: m.userId });
                        setKickTarget(null);
                      })}
                    />
                  ) : (
                    <Button small variant="ghost" label="✕" onPress={() => setKickTarget(m.userId)} />
                  )
                ) : null}
              </View>
            );
          })}
        </Card>
      </Section>

      {!isMaster && me ? (
        <Button
          label={me.ready ? 'SONO PRONTO ✅ (annulla)' : 'SONO PRONTO!'}
          variant={me.ready ? 'dark' : 'gold'}
          loading={busy === 'ready'}
          onPress={() => void act('ready', () => run('lobby:ready', { ready: !me.ready }))}
          style={{ marginTop: S.lg }}
        />
      ) : null}

      {isMaster ? (
        <>
          <Section title="Aggiungi bot" right={full ? <Text style={[T.small, { color: C.red }]}>Lega piena</Text> : undefined}>
            <View style={{ gap: S.sm }}>
              <Button
                variant="gold"
                icon="🎲"
                label="Riempi lega con bot random"
                disabled={full}
                loading={busy === 'bot-random-fill'}
                onPress={() => {
                  const free = view.config.maxParticipants - view.members.length;
                  if (free <= 0) return;
                  void act('bot-random-fill', () => run('lobby:addBots', { archetypes: getRandomBots(free) }));
                }}
              />
              {ARCHETYPES.map((a) => {
                const p = BOT_PROFILES[a];
                return (
                  <Card key={a} style={styles.botRow}>
                    <Text style={{ fontSize: 28 }}>{p.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={T.h3}>{p.label}</Text>
                      <Text style={T.small}>{p.description}</Text>
                    </View>
                    <Button
                      small
                      variant="dark"
                      label="+ Bot"
                      disabled={full}
                      loading={busy === `bot-${a}`}
                      onPress={() => void act(`bot-${a}`, () => run('lobby:addBots', { archetypes: [a] }))}
                    />
                  </Card>
                );
              })}
            </View>
          </Section>

          <Section title="Master">
            <Row>
              <Button variant="dark" icon="⚙️" label="Impostazioni" style={{ flex: 1 }} onPress={() => router.push(`/league/${view.id}/settings`)} />
              <Button variant="dark" icon="🗂️" label="Pool giocatori" style={{ flex: 1 }} onPress={() => router.push(`/league/${view.id}/pool`)} />
            </Row>
          </Section>

          <Button label="INIZIA ASTA" icon="🔨" variant="gold" disabled={!check.ok} loading={busy === 'start'} onPress={() => void start()} style={styles.startBtn} />
          {!check.ok && check.reason ? <Text style={[T.small, { textAlign: 'center', marginTop: S.sm }]}>{check.reason}</Text> : null}
        </>
      ) : (
        <Text style={[T.small, { textAlign: 'center', marginTop: S.md }]}>Il Master avvierà l'asta quando tutti saranno pronti 🔥</Text>
      )}

      <SettingsSummary view={view} />
      <PoolSummary view={view} onPress={() => router.push(`/league/${view.id}/pool`)} />

      {!isMaster ? (
        <Button
          label="Esci dalla lega"
          variant="ghost"
          loading={busy === 'leave'}
          onPress={() => void act('leave', async () => {
            await run('lobby:leave', {});
            useSession.getState().setActiveLeague(null);
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/leagues');
          })}
          style={{ marginTop: S.xl, borderColor: C.red }}
        />
      ) : null}
    </View>
  );
}

// ───────────────────────────── auction

function AuctionLive({ view }: { view: LeagueView }) {
  const lot = view.auction.currentLot?.number ?? view.auction.lotCounter;
  return (
    <Card highlight style={{ marginTop: S.lg, alignItems: 'center', paddingVertical: S.xl }}>
      <Text style={{ fontSize: 44 }}>🔨</Text>
      <Text style={[T.h1, { color: C.gold, marginTop: S.sm }]}>ASTA IN CORSO</Text>
      <Text style={[T.small, { marginTop: S.xs }]}>
        Lotto #{lot} · ancora {view.auction.remainingTotal} elementi {view.auction.status === 'paused' ? '· ⏸️ in pausa' : ''}
      </Text>
      <Button label="ENTRA NELL'ASTA" variant="gold" icon="⚡" style={{ marginTop: S.lg, alignSelf: 'stretch' }} onPress={() => router.push(`/league/${view.id}/auction`)} />
    </Card>
  );
}

// ───────────────────────────── pre season

function PreSeason({ league, view }: { league: LeagueHandle; view: LeagueView }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      await league.run('season:start', {});
      haptic.success();
      goSeason(view.id);
    } catch {
      // toast shown by run()
    } finally {
      setBusy(false);
    }
  };
  const ranked = [...view.teams].sort((a, b) => (rosterValue(b) ?? 0) - (rosterValue(a) ?? 0));
  return (
    <View>
      <Card highlight style={{ marginTop: S.lg, alignItems: 'center' }}>
        <Text style={{ fontSize: 40 }}>📋</Text>
        <Text style={[T.h1, { marginTop: S.sm }]}>Asta conclusa</Text>
        <Text style={[T.small, { textAlign: 'center' }]}>Le rose sono fatte. {league.isMaster ? 'Genera il calendario e che vinca il migliore!' : 'In attesa che il Master generi il calendario...'}</Text>
      </Card>
      <Section title="Riepilogo mercato">
        <Card>
          {ranked.map((t, i) => {
            const value = rosterValue(t);
            return (
              <Row key={t.id} gap={S.md} style={[{ paddingVertical: S.sm }, i > 0 && styles.memberSep]}>
                <TeamBadge logo={t.logo} size={32} />
                <Text style={[T.h3, { flex: 1 }]} numberOfLines={1}>
                  {t.name}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[T.body, T.number, { color: C.gold }]}>{value === null ? '🔒' : `${value} spesi`}</Text>
                  {t.credits !== null ? <Text style={[T.small, T.number]}>{t.credits} rimasti</Text> : null}
                </View>
              </Row>
            );
          })}
        </Card>
      </Section>
      {league.isMaster ? <Button label="GENERA CALENDARIO E INIZIA" icon="📅" variant="gold" loading={busy} onPress={() => void start()} style={styles.startBtn} /> : null}
    </View>
  );
}

// ───────────────────────────── season / completed

function SeasonBlock({ league, view }: { league: LeagueHandle; view: LeagueView }) {
  const [busy, setBusy] = useState(false);
  const t = view.tournament;
  const champion = view.status === 'completed' && t?.championTeamId ? view.teams.find((x) => x.id === t.championTeamId) : null;
  const newSeason = async () => {
    setBusy(true);
    try {
      await league.run('season:new', {});
      toast.gold('Nuova stagione! 🚀', 'Si torna in lobby per una nuova asta');
    } catch {
      // toast shown by run()
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      {champion ? (
        <Card highlight style={[{ marginTop: S.lg, alignItems: 'center' }, styles.champion]}>
          <Text style={{ fontSize: 48 }}>🏆</Text>
          <Text style={[T.tiny, { color: C.gold, marginTop: S.sm }]}>Campione stagione {view.season}</Text>
          <Row style={{ marginTop: S.sm }}>
            <TeamBadge logo={champion.logo} size={40} />
            <Text style={[T.h1, { color: C.goldBright }]} numberOfLines={1}>
              {champion.name}
            </Text>
          </Row>
        </Card>
      ) : null}
      <Card onPress={() => goSeason(view.id)} style={{ marginTop: S.lg }}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 34 }}>{view.status === 'completed' ? '📊' : '⚽'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={T.h2}>{view.status === 'completed' ? 'Rivivi la stagione' : 'Vai al Campionato'}</Text>
            <Text style={T.small}>{t ? `Giornata ${Math.min(t.currentRound, t.totalRounds)}/${t.totalRounds} · classifica, partite e statistiche` : 'Classifica, partite e statistiche'}</Text>
          </View>
          <Text style={{ color: C.gold, fontSize: 26 }}>›</Text>
        </Row>
      </Card>
      {view.status === 'completed' && league.isMaster ? (
        <Button label="Nuova stagione" icon="🚀" variant="gold" loading={busy} onPress={() => void newSeason()} style={{ marginTop: S.lg }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigCode: { fontSize: 44, fontWeight: '900', color: C.goldBright, letterSpacing: 8, marginTop: S.xs },
  qr: { marginTop: S.lg, padding: S.md, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border },
  member: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md },
  memberSep: { borderTopWidth: 1, borderTopColor: C.border },
  botRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  startBtn: { marginTop: S.xl, height: 62 },
  champion: { borderWidth: 2, backgroundColor: `${C.gold}1A` },
});
