import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { TALK_REACTIONS, type LeagueView } from '@asta/core';
import { useSession } from '@/lib/store/session';
import { C, S, T } from '@/lib/theme';
import { Button, Card, Row, TeamBadge } from '@/components/ui';

/**
 * Invitation to the dressing-room talk before an important match of the next
 * round. Once given it shows how the squad took it; it can be skipped.
 */
export function TeamTalkCard({ view }: { view: LeagueView }) {
  const skipped = useSession((s) => s.skippedTalks);
  const offer = view.teamTalk;
  const live = view.tournament?.matches.some((m) => m.status === 'live');
  if (!offer || live || (!offer.given && skipped.includes(offer.matchId))) return null;
  const opponent = view.teams.find((t) => t.id === offer.opponentTeamId);

  if (offer.given) {
    const r = TALK_REACTIONS[offer.given.reaction];
    return (
      <Card style={{ marginTop: S.md }}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 30 }}>{r.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[T.tiny, { color: C.gold }]}>🎙️ SPOGLIATOIO · {offer.reason.toUpperCase()}</Text>
            <Text style={[T.h3, { marginTop: 2 }]}>La squadra è: {r.label.toLowerCase()}</Text>
            <Text style={T.small}>{r.text}</Text>
          </View>
        </Row>
      </Card>
    );
  }

  return (
    <Card highlight style={{ marginTop: S.md }}>
      <Row gap={S.md}>
        {opponent ? <TeamBadge logo={opponent.logo} size={44} /> : <Text style={{ fontSize: 30 }}>🎙️</Text>}
        <View style={{ flex: 1 }}>
          <Text style={[T.tiny, { color: C.gold }]}>🎙️ {offer.reason.toUpperCase()}</Text>
          <Text style={[T.h3, { marginTop: 2 }]}>Discorso allo spogliatoio</Text>
          <Text style={T.small}>Partita che conta{opponent ? ` contro ${opponent.name}` : ''}: parla alla squadra prima del fischio d'inizio.</Text>
        </View>
      </Row>
      <Row style={{ marginTop: S.md }} gap={S.sm}>
        <Button small variant="gold" label="PARLA ALLA SQUADRA" onPress={() => router.push(`/league/${view.id}/talk`)} style={{ flex: 1 }} />
        <Button small variant="ghost" label="Salta" onPress={() => useSession.getState().skipTalk(offer.matchId)} />
      </Row>
    </Card>
  );
}
