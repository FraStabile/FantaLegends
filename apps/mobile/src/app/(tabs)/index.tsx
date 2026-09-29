import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TournamentEngine } from '@asta/core';
import { Avatar, Button, Card, Pill, Row, Screen, Section, TeamBadge } from '@/components/ui';
import { useSession } from '@/lib/store/session';
import { useLeague } from '@/lib/hooks/useLeague';
import { useMyLeagues, type MyLeague } from '@/lib/hooks/useMyLeagues';
import { CHALLENGES, DIFFICULTY_COLOR, startChallenge, type Challenge } from '@/lib/challenges';
import { toast } from '@/lib/store/toasts';
import { C, R, S, T } from '@/lib/theme';
import { ONLINE_ENABLED } from '@/lib/features';

const STATUS_IT: Record<string, string> = { lobby: 'Lobby', auction: 'Asta in corso', pre_season: 'Pre-stagione', season: 'Campionato', completed: 'Conclusa' };

export default function Home() {
  const displayName = useSession((s) => s.displayName);
  const avatar = useSession((s) => s.avatar);
  const activeLeagueId = useSession((s) => s.activeLeagueId);
  const { leagues } = useMyLeagues();

  return (
    <Screen>
      <Row style={{ marginBottom: S.lg }}>
        <Avatar emoji={avatar} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={T.small}>Bentornato,</Text>
          <Text style={T.h2}>{displayName}</Text>
        </View>
        <Text style={[T.tiny, { color: C.gold }]}>ASTA LEGENDS</Text>
      </Row>

      {activeLeagueId && leagues.some((l) => l.id === activeLeagueId) ? <ActiveLeague leagueId={activeLeagueId} /> : null}

      <Challenges leagues={leagues} />

      <Row style={{ marginTop: S.lg }} gap={S.sm}>
        <Button label="Crea lega" icon="🏟️" variant="primary" style={{ flex: 1 }} onPress={() => router.push('/league/create')} />
        {ONLINE_ENABLED ? <Button label="Entra" icon="🔑" variant="dark" style={{ flex: 1 }} onPress={() => router.push('/league/join')} /> : null}
      </Row>

      {leagues.length ? (
        <Section title="Le mie leghe" right={<Text style={[T.small, { color: C.gold }]} onPress={() => router.push('/leagues')}>Tutte</Text>}>
          {leagues.slice(0, 3).map((l) => (
            <Card
              key={l.id}
              style={{ marginBottom: S.sm }}
              onPress={() => {
                useSession.getState().setActiveLeague(l.id);
                router.push(`/league/${l.id}`);
              }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Text style={T.h3}>{l.name}</Text>
                  <Text style={T.small}>
                    {STATUS_IT[l.status] ?? l.status} · {l.members} partecipanti · Stagione {l.season}
                  </Text>
                </View>
                {l.local ? <Pill label="DEMO" color={C.purple} /> : <Pill label={l.code} color={C.blue} />}
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Come si gioca">
        <Card>
          {[
            ['🏟️', 'Crea una lega privata', ONLINE_ENABLED ? 'Scegli crediti, ruoli, formato e regole. Invita gli amici con codice, link o QR.' : 'Scegli crediti, ruoli, formato e regole, poi sfida i bot.'],
            ['🔨', 'Asta live', 'Un campione alla volta, estratto a sorpresa. Rilancia prima che scada il timer.'],
            ['🧠', 'Strategia', 'Tieni i crediti per completare la rosa: portiere, difensore, centrocampista, attaccanti e allenatore.'],
            ['⚽', 'Partite minuto per minuto', 'Il motore simula ogni azione dalle statistiche reali. Telecronaca live, pagelle, MVP.'],
            ['🏆', 'Campionato e premi', 'Classifica, playoff, capocannoniere, affare dell\'asta e albo d\'oro.'],
          ].map(([icon, title, body]) => (
            <Row key={title} style={{ alignItems: 'flex-start', marginBottom: S.md }} gap={S.md}>
              <Text style={{ fontSize: 22 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>{title}</Text>
                <Text style={T.small}>{body}</Text>
              </View>
            </Row>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

/** Contextual card for the league the user is playing right now. */
function ActiveLeague({ leagueId }: { leagueId: string }) {
  const { view, myTeam, catalog } = useLeague(leagueId);
  if (!view) return null;
  const lot = view.auction.currentLot;
  const next = view.tournament ? TournamentEngine.pendingRound(view.tournament as never) : [];
  const myNext = next.find((m) => m.homeTeamId === myTeam?.id || m.awayTeamId === myTeam?.id);
  const live = view.tournament?.matches.filter((m) => m.status === 'live') ?? [];
  const my = view.standings.findIndex((r) => r.teamId === myTeam?.id);

  let cta: { label: string; go: () => void } = { label: 'APRI LA LEGA', go: () => router.push(`/league/${leagueId}`) };
  let line = STATUS_IT[view.status];
  if (view.status === 'auction') {
    cta = { label: 'VAI ALL\'ASTA', go: () => router.push(`/league/${leagueId}/auction`) };
    line = lot ? `Lotto #${lot.number}: ${catalog.find(lot.itemId)?.name} · ${lot.currentBid || 'nessuna offerta'}` : 'Asta in corso';
  } else if (live.length) {
    const mine = live.find((m) => m.homeTeamId === myTeam?.id || m.awayTeamId === myTeam?.id) ?? live[0];
    cta = { label: '● GUARDA LIVE', go: () => router.push(`/match/${leagueId}/${mine.id}`) };
    line = 'Giornata in corso!';
  } else if (view.status === 'season' && myNext) {
    const opp = view.teams.find((t) => t.id === (myNext.homeTeamId === myTeam?.id ? myNext.awayTeamId : myNext.homeTeamId));
    cta = { label: 'CAMPIONATO', go: () => router.push('/season') };
    line = `Prossima: vs ${opp?.name ?? '—'}${my >= 0 ? ` · sei ${my + 1}°` : ''}`;
  }

  return (
    <Card highlight style={{ marginBottom: S.lg }}>
      <Row>
        {myTeam ? <TeamBadge logo={myTeam.logo} size={44} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[T.tiny, { color: C.gold }]}>{view.config.name}</Text>
          <Text style={T.h3}>{myTeam?.name}</Text>
          <Text style={T.small} numberOfLines={1}>
            {line}
          </Text>
        </View>
      </Row>
      <Button label={cta.label} variant="gold" small style={{ marginTop: S.md }} onPress={cta.go} />
    </Card>
  );
}

/** CHALLENGE — ready-made leagues against the bots, the quickest way into the game. */
function Challenges({ leagues }: { leagues: MyLeague[] }) {
  const runs = useSession((s) => s.challengeRuns);
  const [starting, setStarting] = useState<string | null>(null);
  const [featured, ...others] = CHALLENGES;

  const stateOf = (c: Challenge) => {
    const mine = leagues.filter((l) => runs[l.id] === c.id);
    return { won: mine.some((l) => l.won), open: mine.find((l) => l.status !== 'completed') ?? null };
  };

  const play = async (c: Challenge) => {
    const { open } = stateOf(c);
    if (open) {
      useSession.getState().setActiveLeague(open.id);
      router.push(open.status === 'auction' ? `/league/${open.id}/auction` : `/league/${open.id}`);
      return;
    }
    setStarting(c.id);
    try {
      const view = await startChallenge(c);
      router.push(`/league/${view.id}/auction`);
    } catch (e) {
      toast.error('Impossibile avviare la challenge', (e as Error).message);
    } finally {
      setStarting(null);
    }
  };

  const cta = (c: Challenge) => {
    const { won, open } = stateOf(c);
    return open ? 'CONTINUA' : won ? 'RIGIOCA' : 'GIOCA';
  };

  const f = stateOf(featured);
  return (
    <Section title="Challenge" style={{ marginTop: S.md }}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
        <LinearGradient colors={['#3A2D08', '#101A2E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={[T.tiny, { color: C.goldBright }]}>⭐ PER INIZIARE</Text>
          {f.won ? <Pill label="🏆 VINTA" color={C.goldBright} /> : <Pill label={featured.difficulty.toUpperCase()} color={DIFFICULTY_COLOR[featured.difficulty]} />}
        </Row>
        <Text style={[T.h1, { marginTop: 4 }]}>
          {featured.emoji} {featured.title}
        </Text>
        <Text style={[T.small, { color: C.text, marginTop: 6 }]}>{featured.tagline}</Text>
        <Text style={[T.small, { marginTop: 6 }]}>🎯 Obiettivo: vinci il campionato</Text>
        <Button label={cta(featured)} variant="gold" icon="🔨" loading={starting === featured.id} disabled={starting !== null} onPress={() => void play(featured)} style={{ marginTop: S.lg }} />
      </Animated.View>

      <View style={{ gap: S.sm, marginTop: S.md }}>
        {others.map((c) => {
          const st = stateOf(c);
          return (
            <Card key={c.id} style={{ padding: S.md }}>
              <Row gap={S.md}>
                <Text style={{ fontSize: 30 }}>{c.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Text style={T.h3}>{c.title}</Text>
                    {st.won ? <Pill label="🏆 VINTA" color={C.goldBright} /> : <Pill label={c.difficulty.toUpperCase()} color={DIFFICULTY_COLOR[c.difficulty]} />}
                  </Row>
                  <Text style={[T.small, { marginTop: 2 }]}>{c.tagline}</Text>
                </View>
              </Row>
              <Button small label={cta(c)} variant={st.open ? 'primary' : 'dark'} loading={starting === c.id} disabled={starting !== null} onPress={() => void play(c)} style={{ marginTop: S.md }} />
            </Card>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: R.lg, padding: S.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.goldDeep },
});
