import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C, R, S, T } from '@/lib/theme';
import { remoteClient, useSession } from '@/lib/store/session';
import { toast } from '@/lib/store/toasts';
import { haptic } from '@/lib/haptics';
import type { InvitePreview } from '@/lib/net/types';
import { Avatar, Button, Card, Header, Pill, Row, Screen, Section, TextField } from '@/components/ui';
import { QrScanner } from '@/components/league/QrScanner';
import { parseInviteCode, statusInfo } from '@/components/league/labels';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export default function JoinLeagueScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const remote = useSession((s) => s.remote);
  const [code, setCode] = useState(() => (params.code ? parseInviteCode(String(params.code)) ?? clean(String(params.code)) : ''));
  const [teamName, setTeamName] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [joining, setJoining] = useState(false);
  const [scanning, setScanning] = useState(false);

  const valid = code.length === 6;

  const loadPreview = async (c: string) => {
    const client = remoteClient();
    if (!client) {
      toast.error('Non sei connesso a un server', 'Collegati dal Profilo per entrare in una lega online');
      return;
    }
    setLoadingPreview(true);
    try {
      setPreview(await client.invitePreview(c));
    } catch (e) {
      setPreview(null);
      toast.error('Codice non valido', (e as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  };

  // deep link / QR prefill → show the preview straight away
  useEffect(() => {
    if (params.code) {
      const c = parseInviteCode(String(params.code)) ?? clean(String(params.code));
      setCode(c);
      if (c.length === 6 && remoteClient()) void loadPreview(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  const join = async () => {
    const client = remoteClient();
    if (!client) {
      toast.error('Non sei connesso a un server');
      return;
    }
    setJoining(true);
    try {
      const view = await client.joinLeague(code, teamName.trim() || undefined);
      haptic.success();
      toast.gold(`Benvenuto in ${view.config.name}! ⚽`);
      useSession.getState().setActiveLeague(view.id);
      router.replace(`/league/${view.id}`);
    } catch (e) {
      haptic.error();
      toast.error('Impossibile entrare', (e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  const st = preview ? statusInfo(preview.status) : null;

  return (
    <Screen>
      <Row style={{ marginBottom: S.sm }}>
        <Button small variant="ghost" label="‹ Indietro" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/leagues'))} />
      </Row>
      <Header kicker="Invito" title="Entra in una lega" subtitle="Inserisci il codice di 6 caratteri del Master" />

      {!remote ? (
        <Card style={{ marginTop: S.md, borderColor: C.goldDeep }}>
          <Text style={T.h3}>📡 Serve un server</Text>
          <Text style={T.small}>Per giocare online con gli amici collegati a un server dal Profilo.</Text>
          <Button small variant="ghost" label="Vai al Profilo" style={{ marginTop: S.md }} onPress={() => router.push('/(tabs)/profile')} />
        </Card>
      ) : null}

      <Section title="Codice invito">
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(clean(t));
            setPreview(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="X7K92P"
          placeholderTextColor={C.textMute}
          style={[styles.code, T.number]}
        />
        <Row style={{ marginTop: S.md }}>
          <Button label="Anteprima" icon="🔍" variant="dark" style={{ flex: 1 }} disabled={!valid || !remote} loading={loadingPreview} onPress={() => void loadPreview(code)} />
          <Button label="Scansiona QR" icon="📷" variant="ghost" style={{ flex: 1 }} onPress={() => setScanning((s) => !s)} />
        </Row>
      </Section>

      {scanning ? (
        <View style={{ marginTop: S.lg }}>
          <QrScanner
            onClose={() => setScanning(false)}
            onCode={(c) => {
              haptic.success();
              setScanning(false);
              setCode(c);
              void loadPreview(c);
            }}
          />
        </View>
      ) : null}

      {preview && st ? (
        <Section title="Anteprima lega">
          <Card highlight>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill label={`${st.emoji} ${st.label.toUpperCase()}`} color={st.color} />
              <Text style={[T.small, T.number, { color: C.gold, fontWeight: '800' }]}>
                👥 {preview.members.length}/{preview.maxParticipants}
              </Text>
            </Row>
            <Text style={[T.h2, { marginTop: S.sm }]}>{preview.name}</Text>
            <View style={{ marginTop: S.md, gap: S.sm }}>
              {preview.members.map((m, i) => (
                <Row key={`${m.displayName}-${i}`}>
                  <Avatar emoji={m.avatar} size={30} />
                  <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>
                    {m.displayName}
                  </Text>
                  {m.isMaster ? <Pill label="MASTER" /> : null}
                </Row>
              ))}
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title="La tua squadra">
        <TextField label="Nome squadra (facoltativo)" value={teamName} onChangeText={setTeamName} maxLength={28} placeholder="Es. Dinamo Leggenda" />
      </Section>

      <Button label="ENTRA NELLA LEGA" icon="⚽" variant="gold" disabled={!valid || !remote} loading={joining} onPress={() => void join()} style={{ marginTop: S.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: {
    height: 76,
    borderRadius: R.lg,
    borderWidth: 2,
    borderColor: C.gold,
    backgroundColor: C.bgElevated,
    color: C.goldBright,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
  },
});
