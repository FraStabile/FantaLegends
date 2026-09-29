import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { C, S, T } from '@/lib/theme';
import { useMyLeagues, type MyLeague } from '@/lib/hooks/useMyLeagues';
import { useSession } from '@/lib/store/session';
import { timeAgo } from '@/lib/format';
import { Button, Card, EmptyState, Header, Pill, Row, Screen, Section } from '@/components/ui';
import { statusInfo } from '@/components/league/labels';
import { ONLINE_ENABLED } from '@/lib/features';

function openLeague(id: string) {
  useSession.getState().setActiveLeague(id);
  router.push(`/league/${id}`);
}

export default function LeaguesTab() {
  const { leagues, loading, error, refresh } = useMyLeagues();
  const remote = useSession((s) => s.remote);
  const activeId = useSession((s) => s.activeLeagueId);

  return (
    <Screen>
      <Header
        kicker="Asta Legends"
        title="LEGHE"
        subtitle={ONLINE_ENABLED ? 'Le tue sfide, online e demo' : 'Le tue sfide contro i bot'}
        right={<Button small variant="ghost" label="↻" onPress={() => void refresh()} />}
      />

      <Row style={{ marginTop: S.md }}>
        <Button label="Crea lega" icon="➕" variant="gold" style={{ flex: 1 }} onPress={() => router.push('/league/create')} />
        {ONLINE_ENABLED ? <Button label="Entra con codice" icon="🎟️" variant="dark" style={{ flex: 1 }} onPress={() => router.push('/league/join')} /> : null}
      </Row>

      {ONLINE_ENABLED && !remote ? (
        <Card style={styles.hint}>
          <Row gap={S.md}>
            <Text style={{ fontSize: 26 }}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>Modalità offline</Text>
              <Text style={T.small}>Per giocare online con gli amici collegati a un server dal Profilo. Le leghe demo con i bot funzionano comunque!</Text>
            </View>
          </Row>
          <Button small variant="ghost" label="Vai al Profilo" style={{ marginTop: S.md }} onPress={() => router.push('/(tabs)/profile')} />
        </Card>
      ) : null}

      {ONLINE_ENABLED && error ? (
        <Card style={[styles.hint, { borderColor: C.red }]}>
          <Text style={[T.small, { color: C.red }]}>⚠️ Server non raggiungibile: {error}</Text>
        </Card>
      ) : null}

      <Section title={`Le mie leghe${leagues.length ? ` · ${leagues.length}` : ''}`}>
        {loading && leagues.length === 0 ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: S.xl }} />
        ) : leagues.length === 0 ? (
          <EmptyState emoji="🏟️" title="Nessuna lega, ancora" body={ONLINE_ENABLED ? 'Crea la tua lega e invita gli amici, oppure prova subito una demo contro i bot.' : 'Crea la tua lega o prova subito una demo contro i bot.'} />
        ) : (
          <View style={{ gap: S.md }}>
            {leagues.map((l) => (
              <LeagueCard key={l.id} league={l} active={l.id === activeId} />
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}

function LeagueCard({ league, active }: { league: MyLeague; active: boolean }) {
  const st = statusInfo(league.status);
  return (
    <Card onPress={() => openLeague(league.id)} highlight={active}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Pill label={`${st.emoji} ${st.label.toUpperCase()}`} color={st.color} />
            {league.local ? <Pill label="DEMO" color={C.purple} solid /> : null}
            {active ? <Pill label="ATTIVA" color={C.gold} solid /> : null}
          </Row>
          <Text style={[T.h2, { marginTop: S.sm }]} numberOfLines={1}>
            {league.name}
          </Text>
          <Text style={[T.small, { marginTop: 2 }]}>
            👥 {league.members} partecipanti · Stagione {league.season} · {timeAgo(league.updatedAt)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {!league.local ? <Text style={[T.small, T.number, { color: C.gold, fontWeight: '800' }]}>{league.code}</Text> : null}
          <Text style={{ color: C.textMute, fontSize: 22, marginTop: S.sm }}>›</Text>
        </View>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: S.lg, borderColor: C.goldDeep },
});
