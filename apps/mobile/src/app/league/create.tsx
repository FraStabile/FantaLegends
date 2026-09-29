import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_CONFIG, LOGO_COLORS, LOGO_EMOJIS, type LeagueConfig, type TeamLogo } from '@asta/core';
import { C, R, S, T } from '@/lib/theme';
import { localClient, remoteClient, useSession } from '@/lib/store/session';
import { toast } from '@/lib/store/toasts';
import { haptic } from '@/lib/haptics';
import { getRandomBots } from '@/lib/demo';
import { Button, Card, Header, Row, Screen, Section, TeamBadge, TextField } from '@/components/ui';
import { LeagueConfigForm, validateConfig } from '@/components/league/LeagueConfigForm';
import { ONLINE_ENABLED } from '@/lib/features';

type Mode = 'online' | 'demo';

export default function CreateLeagueScreen() {
  const remote = useSession((s) => s.remote);
  const displayName = useSession((s) => s.displayName);
  const onlineAvailable = ONLINE_ENABLED && !!remote;

  const [config, setConfig] = useState<LeagueConfig>({ ...DEFAULT_CONFIG, name: displayName ? `Lega di ${displayName}`.slice(0, 40) : DEFAULT_CONFIG.name });
  const [teamName, setTeamName] = useState('');
  const [logo, setLogo] = useState<TeamLogo>({ emoji: LOGO_EMOJIS[0], color: LOGO_COLORS[0] });
  const [mode, setMode] = useState<Mode>(onlineAvailable ? 'online' : 'demo');
  const [busy, setBusy] = useState(false);

  const effectiveMode: Mode = onlineAvailable ? mode : 'demo';
  const error = validateConfig(config);

  const submit = async () => {
    if (error) {
      toast.error('Controlla le impostazioni', error);
      return;
    }
    setBusy(true);
    try {
      const client = effectiveMode === 'online' ? remoteClient() : localClient();
      if (!client) throw new Error('Non sei connesso a un server');
      const view = await client.createLeague({ config, teamName: teamName.trim() || undefined, logo });
      if (effectiveMode === 'demo') {
        const needed = view.config.maxParticipants - view.members.length;
        if (needed > 0) {
          await client.command(view.id, 'lobby:addBots', { archetypes: getRandomBots(needed) });
        }
      }
      haptic.success();
      toast.gold('Lega creata! 🏆', effectiveMode === 'online' ? `Codice invito: ${view.code}` : 'Bot aggiunti in modalità random! Pronti per l\'asta');
      useSession.getState().setActiveLeague(view.id);
      router.replace(`/league/${view.id}`);
    } catch (e) {
      haptic.error();
      toast.error('Impossibile creare la lega', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Row style={{ marginBottom: S.sm }}>
        <Button small variant="ghost" label="‹ Indietro" onPress={() => router.back()} />
      </Row>
      <Header kicker="Nuova sfida" title="CREA LEGA" subtitle="Tu sei il Master: decidi tu le regole." />

      {ONLINE_ENABLED ? (
      <Section title="Modalità">
        <View style={{ gap: S.sm }}>
          <ModeCard
            active={effectiveMode === 'online'}
            disabled={!onlineAvailable}
            emoji="🌐"
            title="Online (con amici)"
            body={onlineAvailable ? 'Invita gli amici con codice o QR e sfidatevi in tempo reale.' : 'Non sei connesso a un server: collegati dal Profilo per giocare online.'}
            onPress={() => setMode('online')}
          />
          <ModeCard
            active={effectiveMode === 'demo'}
            emoji="🤖"
            title="Demo offline (con bot)"
            body="Tutto sul tuo dispositivo, contro avversari bot con personalità diverse."
            onPress={() => setMode('demo')}
          />
        </View>
      </Section>
      ) : null}

      <Section title="La tua squadra">
        <Card>
          <Row gap={S.md} style={{ marginBottom: S.md }}>
            <TeamBadge logo={logo} size={56} />
            <View style={{ flex: 1 }}>
              <TextField label="Nome squadra" value={teamName} onChangeText={setTeamName} maxLength={28} placeholder={displayName ? `${displayName} FC` : 'Es. Real Leggenda'} />
            </View>
          </Row>
          <Text style={[T.tiny, { marginBottom: 6 }]}>Stemma</Text>
          <View style={styles.grid}>
            {LOGO_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  haptic.tap();
                  setLogo((l) => ({ ...l, emoji: e }));
                }}
                style={[styles.emoji, logo.emoji === e && { borderColor: C.gold, backgroundColor: `${C.gold}22` }]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[T.tiny, { marginTop: S.md, marginBottom: 6 }]}>Colore</Text>
          <View style={styles.grid}>
            {LOGO_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  haptic.tap();
                  setLogo((l) => ({ ...l, color: c }));
                }}
                style={[styles.color, { backgroundColor: c }, logo.color === c && styles.colorActive]}
              />
            ))}
          </View>
        </Card>
      </Section>

      <LeagueConfigForm value={config} onChange={setConfig} />

      <Button
        label={effectiveMode === 'online' ? 'CREA LEGA ONLINE' : ONLINE_ENABLED ? 'CREA LEGA DEMO' : 'CREA LEGA'}
        icon="🏆"
        variant="gold"
        loading={busy}
        disabled={!!error}
        onPress={() => void submit()}
        style={{ marginTop: S.xl }}
      />
    </Screen>
  );
}

function ModeCard({ active, disabled, emoji, title, body, onPress }: { active: boolean; disabled?: boolean; emoji: string; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.mode, active && styles.modeActive, disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[T.h3, active && { color: C.gold }]}>{title}</Text>
        <Text style={T.small}>{body}</Text>
      </View>
      <View style={[styles.radio, active && { borderColor: C.gold }]}>{active ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  emoji: { width: 44, height: 44, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgElevated, alignItems: 'center', justifyContent: 'center' },
  color: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  colorActive: { borderColor: C.text, transform: [{ scale: 1.12 }] },
  mode: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.lg, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  modeActive: { borderColor: C.gold, backgroundColor: '#15203A' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold },
});
