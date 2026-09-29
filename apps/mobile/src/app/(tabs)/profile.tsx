import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Pill, Row, Screen, Section, SwitchRow, TextField, Header } from '@/components/ui';
import { useSession } from '@/lib/store/session';
import { toast } from '@/lib/store/toasts';
import { sfx } from '@/lib/sfx';
import { AVATARS } from '@/lib/format';
import { C, R, S, T } from '@/lib/theme';

export default function Profile() {
  const s = useSession();
  const [name, setName] = useState(s.displayName ?? '');
  const [avatar, setAvatar] = useState(s.avatar);
  const [connecting, setConnecting] = useState(false);
  const [health, setHealth] = useState<{ ai: string } | null>(null);

  useEffect(() => {
    if (!s.remote) return setHealth(null);
    fetch(`${s.remote.serverUrl}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [s.remote]);

  const connect = async () => {
    setConnecting(true);
    try {
      await s.connectServer(s.serverUrl);
      toast.success('Connesso al server!', 'Ora puoi creare leghe online e invitare gli amici');
    } catch (e) {
      toast.error('Connessione fallita', (e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Screen>
      <Header title="Profilo" kicker="Il tuo account" />

      <Section title="Identità">
        <Card>
          <TextField label="Nome" value={name} onChangeText={setName} maxLength={20} />
          <Text style={[T.tiny, { marginBottom: S.sm }]}>Avatar</Text>
          <View style={styles.grid}>
            {AVATARS.map((a) => (
              <Pressable key={a} onPress={() => setAvatar(a)} style={[styles.avatar, avatar === a && styles.avatarActive]}>
                <Text style={{ fontSize: 24 }}>{a}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            label="Salva"
            variant="gold"
            small
            style={{ marginTop: S.md }}
            disabled={name.trim().length < 2}
            onPress={async () => {
              await s.setProfile(name.trim(), avatar);
              toast.success('Profilo aggiornato');
            }}
          />
        </Card>
      </Section>

      <Section title="Gioco online">
        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: S.md }}>
            <Text style={T.h3}>Server</Text>
            {s.remote ? <Pill label="● CONNESSO" color={C.green} /> : <Pill label="OFFLINE · SOLO DEMO" color={C.textDim} />}
          </Row>
          <Text style={[T.small, { marginBottom: S.md }]}>
            Connettiti al server per creare leghe online e invitare gli amici.
          </Text>
          {health ? <Text style={[T.small, { marginBottom: S.md }]}>Generatore AI: {health.ai === 'claude' ? '🤖 Claude attivo' : '📚 database offline'}</Text> : null}
          {s.remote ? (
            <Row gap={S.sm}>
              <Button label="Riconnetti" variant="primary" small loading={connecting} onPress={connect} style={{ flex: 1 }} />
              <Button label="Disconnetti" variant="ghost" small onPress={() => s.disconnectServer()} style={{ flex: 1 }} />
            </Row>
          ) : (
            <Button label="CONNETTI" variant="primary" loading={connecting} onPress={connect} />
          )}
        </Card>
      </Section>

      <Section title="Preferenze">
        <Card>
          <SwitchRow label="Feedback aptico" hint="Vibrazioni per rilanci, gol e aste vinte" value={s.hapticsEnabled} onChange={s.setHaptics} />
          <SwitchRow
            label="Effetti sonori"
            hint="Martelletto, rilanci, fischi e boato del gol"
            value={s.soundEnabled}
            onChange={(on) => {
              s.setSound(on);
              if (!on) sfx.stopAll();
            }}
          />
        </Card>
      </Section>

      <Text style={[T.small, { textAlign: 'center', marginTop: S.xl }]}>Asta Legends · v1.0 · Fatto per rivalità tra amici ⚽</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  avatar: { width: 46, height: 46, borderRadius: R.md, backgroundColor: C.bgElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarActive: { borderColor: C.gold, backgroundColor: `${C.gold}22` },
});
