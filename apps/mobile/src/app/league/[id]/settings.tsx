import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { LeagueConfig } from '@asta/core';
import { C, S, T } from '@/lib/theme';
import { useLeague } from '@/lib/hooks/useLeague';
import { toast } from '@/lib/store/toasts';
import { haptic } from '@/lib/haptics';
import { Button, Card, Header, Row, Screen } from '@/components/ui';
import { LeagueConfigForm, validateConfig } from '@/components/league/LeagueConfigForm';
import { SettingsSummary } from '@/components/league/HubSections';

export default function LeagueSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { view, isMaster, run } = useLeague(id);
  const [draft, setDraft] = useState<LeagueConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // initialise once from the authoritative config
  useEffect(() => {
    if (view && !draft) setDraft(view.config);
  }, [view, draft]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/league/${id}`));

  if (!view) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={C.gold} size="large" />
        </View>
      </Screen>
    );
  }

  const editable = isMaster && view.status === 'lobby';
  const error = draft ? validateConfig(draft) : null;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(view.config);

  const save = async () => {
    if (!draft) return;
    if (error) {
      toast.error('Controlla le impostazioni', error);
      return;
    }
    setSaving(true);
    try {
      await run('lobby:config', { config: draft });
      haptic.success();
      toast.success('Impostazioni salvate ✅');
      back();
    } catch {
      // toast shown by run()
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Row style={{ marginBottom: S.sm }}>
        <Button small variant="ghost" label="‹ Lobby" onPress={back} />
      </Row>
      <Header kicker={view.config.name} title="IMPOSTAZIONI" subtitle={editable ? 'Modifica le regole prima dell\'asta' : 'Regole della lega'} />

      {!editable ? (
        <>
          <Card style={{ marginTop: S.md, borderColor: C.goldDeep }}>
            <Text style={T.small}>
              {isMaster ? '🔒 Le impostazioni si possono cambiare solo in lobby, prima dell\'asta.' : '👑 Solo il Master può modificare le impostazioni.'}
            </Text>
          </Card>
          <SettingsSummary view={view} />
        </>
      ) : draft ? (
        <>
          <LeagueConfigForm value={draft} onChange={setDraft} />
          <Row style={{ marginTop: S.xl }}>
            <Button label="Annulla" variant="ghost" style={{ flex: 1 }} onPress={back} />
            <Button label="SALVA" icon="💾" variant="gold" style={{ flex: 2 }} loading={saving} disabled={!dirty || !!error} onPress={() => void save()} />
          </Row>
          {dirty && view.config.maxParticipants !== draft.maxParticipants && draft.maxParticipants < view.members.length ? (
            <Text style={[T.small, { color: C.red, marginTop: S.sm, textAlign: 'center' }]}>Ci sono già {view.members.length} partecipanti in lobby.</Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
