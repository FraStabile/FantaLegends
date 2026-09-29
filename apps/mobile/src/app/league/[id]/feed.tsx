import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FEED_REACTIONS, type FeedItem, type LeagueView } from '@asta/core';
import { useLeague, useTicker, type LeagueHandle } from '@/lib/hooks/useLeague';
import { C, R, S, T } from '@/lib/theme';
import { timeAgo } from '@/lib/format';
import { Avatar, Button, Card, EmptyState, Header, Row, Screen } from '@/components/ui';

function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type Members = Map<string, LeagueView['members'][number]>;

export default function FeedScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const leagueId = param(params.id) ?? '';
  const handle = useLeague(leagueId);
  const { view, me, run, serverNow } = handle;
  useTicker(30_000);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const members: Members = useMemo(() => new Map((view?.members ?? []).map((m) => [m.userId, m])), [view?.members]);
  const feed = useMemo(() => [...(view?.feed ?? [])].sort((a, b) => b.at - a.at), [view?.feed]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/league/${leagueId}`));

  if (!view) {
    return (
      <Screen scroll={false}>
        {handle.error ? <EmptyState emoji="📡" title="Lega non raggiungibile" body={handle.error} /> : <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 80 }} />}
      </Screen>
    );
  }

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await run('feed:chat', { text: t });
      setText('');
    } catch {
      // toast shown by run()
    } finally {
      setSending(false);
    }
  };

  const now = serverNow();

  return (
    <Screen>
      <Pressable onPress={back} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: S.sm }}>
        <Text style={[T.body, { color: C.gold, fontWeight: '800' }]}>‹ Indietro</Text>
      </Pressable>
      <Header kicker={view.config.name} title="Bar della Lega" subtitle="Sfottò, colpi di mercato e risultati: tutto qui." />

      <Card style={{ marginTop: S.md, padding: S.md }}>
        <Row gap={S.sm} style={{ alignItems: 'flex-end' }}>
          <Avatar emoji={me?.avatar ?? '🙂'} size={36} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Scrivi alla lega…"
            placeholderTextColor={C.textMute}
            style={styles.composer}
            multiline
            maxLength={280}
            onSubmitEditing={() => void send()}
            submitBehavior="blurAndSubmit"
          />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: S.sm }}>
          <Text style={[T.small, { fontSize: 11 }]}>{text.length}/280</Text>
          <Button small variant="gold" label="INVIA" icon="📣" loading={sending} disabled={!text.trim()} onPress={() => void send()} />
        </Row>
      </Card>

      {feed.length ? (
        feed.map((item) => <FeedCard key={item.id} item={item} members={members} viewerId={view.viewerId} now={now} run={run} />)
      ) : (
        <EmptyState emoji="🦗" title="Silenzio in sala" body="Nessuno ha ancora parlato. Rompi il ghiaccio con la prima provocazione!" />
      )}
    </Screen>
  );
}

function FeedCard({ item, members, viewerId, now, run }: { item: FeedItem; members: Members; viewerId: string; now: number; run: LeagueHandle['run'] }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const isChat = item.kind === 'chat';
  const comments = showAll ? item.comments : item.comments.slice(-3);
  const hidden = item.comments.length - comments.length;

  const react = (emoji: string) => {
    run('feed:react', { feedId: item.id, emoji }).catch(() => {});
  };

  const submit = async () => {
    const t = comment.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await run('feed:comment', { feedId: item.id, text: t });
      setComment('');
      setOpen(false);
    } catch {
      // toast shown by run()
    } finally {
      setSending(false);
    }
  };

  const nameOf = (userId: string) => members.get(userId)?.displayName ?? 'Ex membro';

  return (
    <Card style={[{ marginTop: S.md }, isChat && { borderColor: C.borderStrong }]}>
      <Row style={{ alignItems: 'flex-start' }} gap={S.md}>
        <View style={[styles.emoji, isChat && { backgroundColor: `${C.blue}22`, borderColor: `${C.blue}66` }]}>
          <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { lineHeight: 21 }]}>{item.text}</Text>
          <Text style={[T.small, { fontSize: 11, marginTop: 4 }]}>
            {isChat ? '💬 Chat · ' : ''}
            {timeAgo(item.at, now)}
          </Text>
        </View>
      </Row>

      <View style={styles.reactions}>
        {FEED_REACTIONS.map((e) => {
          const users = item.reactions[e] ?? [];
          const mine = users.includes(viewerId);
          return (
            <Pressable key={e} onPress={() => react(e)} style={({ pressed }) => [styles.reaction, mine && styles.reactionMine, pressed && { transform: [{ scale: 0.92 }] }]}>
              <Text style={{ fontSize: 15 }}>{e}</Text>
              {users.length ? <Text style={[styles.reactionCount, mine && { color: C.goldBright }]}>{users.length}</Text> : null}
            </Pressable>
          );
        })}
        <Pressable onPress={() => setOpen((o) => !o)} style={styles.commentBtn}>
          <Text style={[T.small, { color: C.text, fontWeight: '800' }]}>💬 Commenta{item.comments.length ? ` · ${item.comments.length}` : ''}</Text>
        </Pressable>
      </View>

      {item.comments.length ? (
        <View style={styles.comments}>
          {hidden > 0 ? (
            <Pressable onPress={() => setShowAll(true)}>
              <Text style={[T.small, { color: C.gold, marginBottom: 6 }]}>Mostra altri {hidden} commenti</Text>
            </Pressable>
          ) : null}
          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Avatar emoji={members.get(c.userId)?.avatar ?? '👤'} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={T.small}>
                  <Text style={{ color: c.userId === viewerId ? C.goldBright : C.text, fontWeight: '800' }}>{nameOf(c.userId)}</Text> {c.text}
                </Text>
                <Text style={[T.small, { fontSize: 10, color: C.textMute }]}>{timeAgo(c.at, now)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {open ? (
        <Row style={{ marginTop: S.sm }} gap={S.sm}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Dì la tua…"
            placeholderTextColor={C.textMute}
            style={styles.commentInput}
            autoFocus
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
          />
          <Button small variant="gold" label="➤" loading={sending} disabled={!comment.trim()} onPress={() => void submit()} />
        </Row>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  composer: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: C.bgElevated, borderRadius: R.md, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: S.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, fontWeight: '500' },
  emoji: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.cardHigh, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: S.md, alignItems: 'center' },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border },
  reactionMine: { borderColor: C.gold, backgroundColor: `${C.gold}22` },
  reactionCount: { color: C.textDim, fontWeight: '900', fontSize: 12, ...T.number },
  commentBtn: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6 },
  comments: { marginTop: S.md, paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border },
  comment: { flexDirection: 'row', gap: S.sm, alignItems: 'flex-start', paddingVertical: 5 },
  commentInput: { flex: 1, height: 40, backgroundColor: C.bgElevated, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: S.md, fontSize: 14 },
});
