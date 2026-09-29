import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { TALK_PHRASES, TALK_REACTIONS, TALK_TONES, type TalkPhrase, type TalkTone, type TeamTalk } from '@asta/core';
import { useLeague } from '@/lib/hooks/useLeague';
import { useSession } from '@/lib/store/session';
import { C, R, S, T } from '@/lib/theme';
import { haptic } from '@/lib/haptics';
import { sfx } from '@/lib/sfx';
import { Button, Card, Chip, EmptyState, Header, Row, Screen, TeamBadge } from '@/components/ui';

function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** DISCORSO ALLO SPOGLIATOIO — one message and one tone, then the squad reacts. */
export default function TeamTalkScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const leagueId = param(params.id) ?? '';
  const { view, run } = useLeague(leagueId);
  const [phrase, setPhrase] = useState<TalkPhrase | null>(null);
  const [tone, setTone] = useState<TalkTone | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TeamTalk | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/season'));
  const offer = view?.teamTalk ?? null;
  const talk = result ?? offer?.given ?? null;

  if (!view) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  if (!offer && !talk) {
    return (
      <Screen>
        <EmptyState emoji="🚪" title="Spogliatoio chiuso" body="Il discorso si fa solo prima delle partite importanti della prossima giornata." action={<Button label="INDIETRO" variant="dark" onPress={back} />} />
      </Screen>
    );
  }

  const opponent = offer ? view.teams.find((t) => t.id === offer.opponentTeamId) : null;

  const speak = async () => {
    if (!offer || !phrase || !tone) return;
    setBusy(true);
    try {
      const t = (await run('match:talk', { matchId: offer.matchId, phrase, tone })) as TeamTalk;
      setResult(t);
      if (t.reaction === 'fired_up' || t.reaction === 'focused') {
        haptic.success();
        sfx.play('chance');
      } else if (t.reaction === 'neutral') haptic.tap();
      else {
        haptic.warning();
        sfx.play('miss');
      }
    } catch {
      // toast already shown by run()
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    if (offer) useSession.getState().skipTalk(offer.matchId);
    back();
  };

  return (
    <Screen>
      <Row style={{ marginBottom: S.sm }}>
        <Button small variant="ghost" label="‹ Indietro" onPress={back} />
      </Row>
      <Header kicker={`🎙️ ${offer?.reason ?? 'Spogliatoio'}`} title="DISCORSO ALLO SPOGLIATOIO" subtitle={opponent ? `Prima della sfida contro ${opponent.name}` : undefined} />

      {offer ? (
        <Card style={{ marginTop: S.md }}>
          <Row gap={S.md}>
            {opponent ? <TeamBadge logo={opponent.logo} size={44} /> : null}
            <View style={{ flex: 1, gap: 4 }}>
              {offer.hints.map((h) => (
                <Text key={h} style={T.small}>
                  {h}
                </Text>
              ))}
            </View>
          </Row>
        </Card>
      ) : null}

      {talk ? (
        <Reaction talk={talk} onDone={back} />
      ) : (
        <>
          <Text style={[T.tiny, styles.label]}>COSA DICI ALLA SQUADRA</Text>
          <View style={{ gap: S.sm }}>
            {TALK_PHRASES.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  haptic.tap();
                  setPhrase(p.id);
                }}
                style={[styles.phrase, phrase === p.id && styles.phraseActive]}>
                <Text style={[T.body, phrase === p.id && { color: C.gold }]}>“{p.text}”</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[T.tiny, styles.label]}>CON CHE TONO</Text>
          <Row style={{ flexWrap: 'wrap' }} gap={S.sm}>
            {TALK_TONES.map((t) => (
              <Chip key={t.id} label={`${t.emoji} ${t.label}`} active={tone === t.id} onPress={() => setTone(t.id)} />
            ))}
          </Row>
          <Text style={[T.small, { marginTop: S.sm }]}>
            Leggi la situazione: le parole giuste caricano la squadra, quelle sbagliate la rendono nervosa o troppo sicura di sé. Un tono aggressivo pesa di più, nel bene e nel male, e porta qualche cartellino in più.
          </Text>

          <Button label="PARLA ALLA SQUADRA" icon="🎙️" variant="gold" loading={busy} disabled={!phrase || !tone} onPress={() => void speak()} style={{ marginTop: S.xl }} />
          <Button label="Salta il discorso" variant="ghost" onPress={skip} style={{ marginTop: S.sm }} />
        </>
      )}
    </Screen>
  );
}

function Reaction({ talk, onDone }: { talk: TeamTalk; onDone: () => void }) {
  const r = TALK_REACTIONS[talk.reaction];
  const phrase = TALK_PHRASES.find((p) => p.id === talk.phrase)?.text;
  const tone = TALK_TONES.find((t) => t.id === talk.tone);
  const good = talk.reaction === 'fired_up' || talk.reaction === 'focused';
  const bad = talk.reaction === 'complacent' || talk.reaction === 'nervous';
  const effects = [
    talk.morale > 0 ? '⬆️ Morale in crescita' : talk.morale < 0 ? '⬇️ Morale in calo' : null,
    talk.focus < 1 ? '🎯 Meno errori in difesa' : talk.focus > 1 ? '⚠️ Più distrazioni in difesa' : null,
    talk.discipline > 1.05 ? '🟨 Rischio cartellini più alto' : null,
  ].filter((e): e is string => !!e);
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Card highlight style={{ marginTop: S.lg, alignItems: 'center', borderColor: good ? C.green : bad ? C.red : C.border }}>
        <Animated.Text entering={ZoomIn.springify().damping(10)} style={{ fontSize: 56 }}>
          {r.emoji}
        </Animated.Text>
        <Text style={[T.h1, { marginTop: S.xs, color: good ? C.green : bad ? C.red : C.text }]}>{r.label.toUpperCase()}</Text>
        <Text style={[T.body, { textAlign: 'center', marginTop: S.xs }]}>{r.text}</Text>
        {phrase ? (
          <Text style={[T.small, { textAlign: 'center', marginTop: S.md }]}>
            {tone?.emoji} “{phrase}”
          </Text>
        ) : null}
        <View style={{ marginTop: S.md, gap: 4, alignSelf: 'stretch' }}>
          {(effects.length ? effects : ['Nessun effetto particolare sulla partita']).map((e) => (
            <Text key={e} style={[T.small, { textAlign: 'center' }]}>
              {e}
            </Text>
          ))}
        </View>
      </Card>
      <Button label="VAI IN CAMPO" variant="gold" onPress={onDone} style={{ marginTop: S.lg }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: S.xl, marginBottom: S.sm },
  phrase: { padding: S.md, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  phraseActive: { borderColor: C.gold, backgroundColor: '#15203A' },
});
