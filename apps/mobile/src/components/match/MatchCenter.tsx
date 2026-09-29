import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useScreenAwake } from '@/lib/hooks/useScreenAwake';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { strengthView, TALK_REACTIONS, type Catalog, type LeagueView, type MatchEvent, type MatchView, type TeamStrengthView } from '@asta/core';
import { Button, Card, Chip, Pill, Row, Segmented, StatBar, TeamBadge } from '@/components/ui';
import { useLeague } from '@/lib/hooks/useLeague';
import { clientFor } from '@/lib/store/session';
import { C, R, S, SLOT_COLORS, T } from '@/lib/theme';
import { EVENT_ICON, SLOT_SHORT, STAGE_IT, TACTIC_IT, minuteLabel, shortName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { sfx, type SoundName } from '@/lib/sfx';
import { matchClock, usePlayback, type Speed } from './usePlayback';

type Tab = 'live' | 'stats' | 'lineups';

/** Which effect a timeline event triggers, if any. */
function soundFor(e: MatchEvent): SoundName | null {
  switch (e.type) {
    case 'goal':
    case 'own_goal':
    case 'penalty_scored':
      return 'goal';
    case 'kickoff':
    case 'halftime':
      return 'whistle';
    case 'fulltime':
      return 'whistle_end';
    case 'post':
    case 'crossbar':
      return 'post';
    case 'yellow':
    case 'red':
      return 'card';
    case 'big_chance':
    case 'penalty_awarded':
    case 'counter':
      return 'chance';
    case 'penalty_missed':
      return 'miss';
    case 'save':
    case 'miss':
      return e.importance >= 2 ? 'miss' : null;
    case 'shootout_kick':
      return e.detail === 'scored' ? 'goal' : 'miss';
    default:
      return null;
  }
}

const SOUND_RANK: Record<SoundName, number> = {
  goal: 9, whistle_end: 8, post: 7, card: 6, miss: 5, chance: 4, whistle: 3,
  lot_open: 0, bid: 0, bid_mine: 0, outbid: 0, tick: 0, sold: 0, sold_mine: 0, unsold: 0, crowd_loop: 0,
};

/** MATCH CENTER — full screen pre-match / live / full-time experience. */
export function MatchCenter({ leagueId, matchId }: { leagueId: string; matchId: string }) {
  useScreenAwake('match');
  const league = useLeague(leagueId);
  const [match, setMatch] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('live');
  const [importantOnly, setImportantOnly] = useState(false);
  const [celebration, setCelebration] = useState<MatchEvent | null>(null);
  const summaryStatus = league.view?.tournament?.matches.find((m) => m.id === matchId)?.status;

  // pull the match: live events are revealed progressively by the server, so poll while live
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const m = await clientFor(leagueId).getMatch(leagueId, matchId);
        if (!alive) return;
        setMatch(m);
        setError(null);
        if (m.summary.status !== 'finished') timer = setTimeout(load, 1500);
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message);
        timer = setTimeout(load, 3000);
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [leagueId, matchId, summaryStatus]);

  const pb = usePlayback(match, league.serverNow);
  const shown = useMemo(() => (match ? match.events.filter((e) => e.t <= pb.pos) : []), [match, pb.pos]);
  const last = shown[shown.length - 1];
  const score = last ? [last.homeGoals, last.awayGoals] : [0, 0];
  const ended = !!match && match.summary.status === 'finished' && shown.some((e) => e.type === 'fulltime');

  // goal celebration when a new goal enters the timeline
  const seenGoals = useRef<Set<number>>(new Set());
  const firstRender = useRef(true);
  useEffect(() => {
    const goals = shown.filter((e) => e.type === 'goal' || e.type === 'penalty_scored' || e.type === 'own_goal');
    const fresh = goals.filter((g) => !seenGoals.current.has(g.seq));
    goals.forEach((g) => seenGoals.current.add(g.seq));
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (fresh.length && pb.playing) {
      setCelebration(fresh[fresh.length - 1]);
      haptic.heavy();
    }
  }, [shown.length]);

  // sound: one effect per step (the most important of the new events), silent on big jumps
  const heardSeq = useRef<number | null>(null);
  useEffect(() => {
    const lastSeq = last?.seq ?? -1;
    const prev = heardSeq.current;
    heardSeq.current = lastSeq;
    if (prev === null || lastSeq <= prev || !pb.playing) return;
    const fresh = shown.filter((e) => e.seq > prev);
    if (fresh.length > 6) return; // skip/seek: no cacophony
    const sound = fresh.map(soundFor).filter((s): s is SoundName => !!s).sort((a, b) => SOUND_RANK[b] - SOUND_RANK[a])[0];
    if (sound) sfx.play(sound);
  }, [last?.seq]);

  // stadium ambience while the ball is rolling
  const rolling = !!match && pb.playing && shown.length > 0 && !shown.some((e) => e.type === 'fulltime');
  useEffect(() => {
    sfx.crowd(rolling);
  }, [rolling]);
  useEffect(() => () => sfx.crowd(false), []);

  // the celebration closes on its own timer, independent of new events arriving meanwhile
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 2600);
    return () => clearTimeout(t);
  }, [celebration]);

  if (!match || !league.view) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 120 }} />
        {error ? <Text style={[T.small, { textAlign: 'center', marginTop: S.md }]}>{error}</Text> : null}
      </View>
    );
  }

  const clock = matchClock(match, pb.pos);
  const isLive = match.summary.status === 'live';
  const beforeKickoff = match.summary.status === 'scheduled' || (isLive && pb.pos <= 0);
  const name = (id: string | null) => (id ? shortName(match.players[id]?.name ?? '') : '');

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0E2242', C.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Row style={{ paddingHorizontal: S.lg, justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[T.h2, { color: C.textDim }]}>✕</Text>
          </Pressable>
          <Text style={[T.tiny, { color: C.gold }]}>
            {STAGE_IT[match.summary.stage]}
            {match.summary.stage === 'league' || match.summary.stage === 'group' ? ` · GIORNATA ${match.summary.round}` : ''}
          </Text>
          {isLive ? <Pill label="● LIVE" color={C.red} solid /> : ended ? <Pill label="FULL TIME" color={C.gold} /> : <Pill label="PRE-MATCH" color={C.blue} />}
        </Row>

        {/* Scoreboard */}
        <View style={styles.scoreboard}>
          <TeamSide info={match.home} />
          <View style={{ alignItems: 'center', minWidth: 120 }}>
            <Text style={styles.score}>
              {beforeKickoff ? 'VS' : `${score[0]} - ${score[1]}`}
            </Text>
            {match.summary.homePens !== null && ended ? <Text style={[T.small, { color: C.gold }]}>({match.summary.homePens}-{match.summary.awayPens} d.c.r.)</Text> : null}
            <Text style={[styles.clock, clock.phase === 'end' && { color: C.gold }]}>{beforeKickoff ? (isLive ? 'Calcio d\'inizio…' : 'In programma') : clock.label}</Text>
          </View>
          <TeamSide info={match.away} />
        </View>
        {match.summary.talks?.length ? <DressingRoom match={match} /> : null}

        {beforeKickoff ? (
          <PreMatch match={match} view={league.view} catalog={league.catalog} />
        ) : (
          <>
            <View style={{ paddingHorizontal: S.lg }}>
              <Controls pb={pb} finished={match.summary.status === 'finished'} importantOnly={importantOnly} setImportantOnly={setImportantOnly} />
              <Segmented<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'live', label: 'TELECRONACA' },
                  { value: 'stats', label: 'STATISTICHE' },
                  { value: 'lineups', label: 'FORMAZIONI' },
                ]}
              />
            </View>
            <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 80 }}>
              <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
                {ended && tab === 'live' ? <FullTime match={match} /> : null}
                {tab === 'live' ? <Commentary events={shown} importantOnly={importantOnly} match={match} /> : null}
                {tab === 'stats' ? <StatsPanel match={match} events={shown} ended={ended} /> : null}
                {tab === 'lineups' ? <Lineups match={match} ended={ended} /> : null}
              </View>
            </ScrollView>
          </>
        )}
      </SafeAreaView>

      {celebration ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut} style={styles.celebration} pointerEvents="none">
          <Animated.Text entering={ZoomIn.springify().damping(9)} style={styles.goalText}>
            {celebration.type === 'own_goal' ? 'AUTOGOL!' : 'GOOOOOL!'}
          </Animated.Text>
          <Text style={[T.h1, { textAlign: 'center' }]}>{name(celebration.playerId)}</Text>
          <Text style={[T.h2, { color: C.gold, marginTop: S.sm }]}>
            {celebration.homeGoals} - {celebration.awayGoals}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** How each squad took its pre-match talk (revealed at kickoff). */
function DressingRoom({ match }: { match: MatchView }) {
  const talkOf = (teamId: string) => match.summary.talks?.find((t) => t.teamId === teamId);
  const cell = (teamId: string) => {
    const t = talkOf(teamId);
    const r = t ? TALK_REACTIONS[t.reaction] : null;
    return <Text style={[T.small, { flex: 1, textAlign: 'center' }]}>{r ? `${r.emoji} ${r.label}` : '— nessun discorso'}</Text>;
  };
  return (
    <View style={styles.dressingRoom}>
      <Text style={[T.tiny, { color: C.gold, textAlign: 'center', marginBottom: 4 }]}>🎙️ SPOGLIATOIO</Text>
      <Row>
        {cell(match.home.id)}
        {cell(match.away.id)}
      </Row>
    </View>
  );
}

function TeamSide({ info }: { info: MatchView['home'] }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <TeamBadge logo={info.logo} size={56} />
      <Text style={[T.h3, { textAlign: 'center' }]} numberOfLines={2}>
        {info.name.toUpperCase()}
      </Text>
      <Text style={T.small}>{info.ownerName}</Text>
    </View>
  );
}

function Controls({ pb, finished, importantOnly, setImportantOnly }: { pb: ReturnType<typeof usePlayback>; finished: boolean; importantOnly: boolean; setImportantOnly: (v: boolean) => void }) {
  const speeds: Speed[] = [1, 2, 4, 10];
  return (
    <Row style={{ marginBottom: S.md, flexWrap: 'wrap' }} gap={6}>
      <Pressable onPress={() => pb.setPlaying(!pb.playing)} style={styles.ctrl}>
        <Text style={styles.ctrlText}>{pb.playing ? '⏸' : '▶'}</Text>
      </Pressable>
      {speeds.map((s) => (
        <Pressable key={s} onPress={() => pb.setSpeed(s)} style={[styles.ctrl, pb.speed === s && { backgroundColor: C.gold }]}>
          <Text style={[styles.ctrlText, pb.speed === s && { color: '#1A1405' }]}>{s}×</Text>
        </Pressable>
      ))}
      {pb.liveEdge !== null ? (
        <Pressable onPress={pb.goLive} style={[styles.ctrl, pb.atLive && { backgroundColor: C.red }]}>
          <Text style={styles.ctrlText}>● LIVE</Text>
        </Pressable>
      ) : null}
      {finished ? (
        <Pressable onPress={pb.restart} style={styles.ctrl}>
          <Text style={styles.ctrlText}>⟲ Rivedi</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }} />
      <Chip label="Solo importanti" active={importantOnly} onPress={() => setImportantOnly(!importantOnly)} />
    </Row>
  );
}

function Commentary({ events, importantOnly, match }: { events: MatchEvent[]; importantOnly: boolean; match: MatchView }) {
  const list = [...events].reverse().filter((e) => !importantOnly || e.importance >= 2);
  return (
    <View style={{ gap: S.sm }}>
      {list.map((e) => {
        const key = e.importance === 3;
        const goal = e.type === 'goal' || e.type === 'penalty_scored' || e.type === 'own_goal';
        const side = e.teamId === match.home.id ? 'home' : e.teamId === match.away.id ? 'away' : null;
        return (
          <Animated.View key={e.seq} entering={FadeInDown.duration(350)} style={[styles.event, key && styles.eventKey, goal && styles.eventGoal, side === 'away' && { borderLeftColor: match.away.logo.color }, side === 'home' && { borderLeftColor: match.home.logo.color }]}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Text style={[styles.minute, goal && { color: C.gold }]}>{minuteLabel(e)}</Text>
              <Text style={{ fontSize: key ? 20 : 15 }}>{EVENT_ICON[e.type] ?? '•'}</Text>
              <View style={{ flex: 1 }}>
                {goal ? <Text style={[T.h3, { color: C.gold }]}>{e.type === 'own_goal' ? 'AUTOGOL!' : 'GOOOOOL!'} {e.homeGoals}-{e.awayGoals}</Text> : null}
                {e.type === 'save' && key ? <Text style={[T.h3, { color: C.cyan }]}>GRANDE PARATA!</Text> : null}
                <Text style={[key ? T.body : T.small, { color: key ? C.text : C.textDim, lineHeight: key ? 21 : 19 }]}>{e.commentary}</Text>
              </View>
            </Row>
          </Animated.View>
        );
      })}
    </View>
  );
}

function liveStats(events: MatchEvent[], teamId: string) {
  const mine = (types: MatchEvent['type'][]) => events.filter((e) => e.teamId === teamId && types.includes(e.type)).length;
  return {
    shots: mine(['shot']) + events.filter((e) => e.type === 'penalty_awarded' && e.teamId === teamId).length,
    corners: mine(['corner']),
    fouls: mine(['foul']),
    yellows: mine(['yellow']),
    reds: mine(['red']),
    xg: Math.round(events.filter((e) => e.teamId === teamId && (e.type === 'shot' || e.type === 'penalty_awarded')).reduce((s, e) => s + (e.type === 'penalty_awarded' ? 0.76 : (e.xg ?? 0)), 0) * 100) / 100,
  };
}

function StatsPanel({ match, events, ended }: { match: MatchView; events: MatchEvent[]; ended: boolean }) {
  const f = ended ? match.final : null;
  const h = f ? f.homeStats : null;
  const a = f ? f.awayStats : null;
  const lh = liveStats(events, match.home.id);
  const la = liveStats(events, match.away.id);
  const rows: [string, number, number][] = f
    ? [
        ['Possesso %', h!.possession, a!.possession],
        ['Tiri', h!.shots, a!.shots],
        ['Tiri in porta', h!.shotsOnTarget, a!.shotsOnTarget],
        ['xG', h!.xg, a!.xg],
        ['Grandi occasioni', h!.bigChances, a!.bigChances],
        ['Corner', h!.corners, a!.corners],
        ['Falli', h!.fouls, a!.fouls],
        ['Gialli', h!.yellows, a!.yellows],
        ['Rossi', h!.reds, a!.reds],
        ['Passaggi', h!.passes, a!.passes],
        ['Dribbling', h!.dribbles, a!.dribbles],
        ['Parate', h!.saves, a!.saves],
      ]
    : [
        ['Tiri', lh.shots, la.shots],
        ['xG', lh.xg, la.xg],
        ['Corner', lh.corners, la.corners],
        ['Falli', lh.fouls, la.fouls],
        ['Gialli', lh.yellows, la.yellows],
        ['Rossi', lh.reds, la.reds],
      ];
  return (
    <Card>
      {!f ? <Text style={[T.small, { marginBottom: S.md }]}>Statistiche live · possesso e pagelle al fischio finale</Text> : null}
      {rows.map(([label, x, y]) => {
        const total = x + y || 1;
        return (
          <View key={label} style={{ marginBottom: S.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[T.h3, T.number, { color: x >= y ? C.text : C.textDim }]}>{x}</Text>
              <Text style={T.small}>{label}</Text>
              <Text style={[T.h3, T.number, { color: y >= x ? C.text : C.textDim }]}>{y}</Text>
            </Row>
            <Row gap={4} style={{ marginTop: 4 }}>
              <View style={[styles.statBar, { flex: x / total || 0.001, backgroundColor: match.home.logo.color }]} />
              <View style={[styles.statBar, { flex: y / total || 0.001, backgroundColor: match.away.logo.color }]} />
            </Row>
          </View>
        );
      })}
    </Card>
  );
}

function Lineups({ match, ended }: { match: MatchView; ended: boolean }) {
  if (!match.lineups) return null;
  const ratings = new Map(ended && match.final ? match.final.playerStats.map((p) => [p.playerId, p]) : []);
  return (
    <View style={{ gap: S.md }}>
      {(['home', 'away'] as const).map((side) => {
        const lu = match.lineups![side];
        const info = match[side];
        return (
          <Card key={side}>
            <Row>
              <TeamBadge logo={info.logo} size={30} />
              <Text style={[T.h3, { flex: 1 }]}>{info.name}</Text>
              <Pill label={`${lu.formation} · ${TACTIC_IT[lu.tactic]}`} color={C.blue} />
            </Row>
            <View style={{ marginTop: S.md, gap: 6 }}>
              {lu.players.map((p) => {
                const r = ratings.get(p.playerId);
                return (
                  <Row key={p.playerId} style={styles.lineRow}>
                    <View style={[styles.posDot, { backgroundColor: SLOT_COLORS[p.position] }]}>
                      <Text style={styles.posText}>{SLOT_SHORT[p.position]}</Text>
                    </View>
                    <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>
                      {p.name}
                      {r?.goals ? ` ${'⚽'.repeat(r.goals)}` : ''}
                      {r?.assists ? ` ${'🅰️'.repeat(r.assists)}` : ''}
                      {r?.red ? ' 🟥' : r?.yellow ? ' 🟨' : ''}
                    </Text>
                    {r ? <RatingBadge value={r.rating} mvp={match.final?.mvpPlayerId === p.playerId} /> : <Text style={[T.small, T.number]}>{p.overall}</Text>}
                  </Row>
                );
              })}
            </View>
            <View style={{ marginTop: S.md }}>
              <StrengthBars s={lu.strength} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

function RatingBadge({ value, mvp }: { value: number; mvp?: boolean }) {
  const color = value >= 8 ? C.green : value >= 6.5 ? C.gold : value >= 5.5 ? C.orange : C.red;
  return (
    <View style={[styles.rating, { borderColor: color, backgroundColor: mvp ? color : `${color}22` }]}>
      <Text style={[T.number, { color: mvp ? '#0A0A0A' : color, fontWeight: '900' }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

function StrengthBars({ s }: { s: TeamStrengthView }) {
  return (
    <View>
      <StatBar label="Attacco" value={s.attack} />
      <StatBar label="Centrocampo" value={s.midfield} />
      <StatBar label="Difesa" value={s.defense} />
      <StatBar label="Portiere" value={s.goalkeeper} />
    </View>
  );
}

function FullTime({ match }: { match: MatchView }) {
  const f = match.final!;
  const goals = match.events.filter((e) => e.type === 'goal' || e.type === 'penalty_scored' || e.type === 'own_goal');
  const mvp = f.playerStats.find((p) => p.playerId === f.mvpPlayerId);
  const nm = (id: string | null) => (id ? match.players[id]?.name ?? '' : '');
  const ratings = (teamId: string) => f.playerStats.filter((p) => p.teamId === teamId).sort((a, b) => b.rating - a.rating);
  return (
    <Animated.View entering={FadeInDown} style={{ marginBottom: S.lg, gap: S.md }}>
      <Card highlight>
        <Text style={[T.tiny, { color: C.gold, textAlign: 'center' }]}>FULL TIME</Text>
        <Text style={[T.h2, { textAlign: 'center', marginTop: 4 }]}>
          {match.home.name} {match.summary.homeGoals}-{match.summary.awayGoals} {match.away.name}
        </Text>
        <View style={{ marginTop: S.md, gap: 4 }}>
          {goals.map((g) => (
            <Row key={g.seq} style={{ justifyContent: g.teamId === match.home.id || (g.type === 'own_goal' && g.teamId === match.away.id) ? 'flex-start' : 'flex-end' }}>
              <Text style={T.body}>
                ⚽ {minuteLabel(g)} {shortName(nm(g.playerId))}
                {g.type === 'penalty_scored' ? ' (rig.)' : g.type === 'own_goal' ? ' (aut.)' : ''}
              </Text>
            </Row>
          ))}
        </View>
        {mvp ? (
          <Row style={{ marginTop: S.lg, justifyContent: 'center' }}>
            <Text style={[T.h3, { color: C.gold }]}>⭐ MVP: {nm(mvp.playerId)}</Text>
            <RatingBadge value={mvp.rating} mvp />
          </Row>
        ) : null}
      </Card>
      <Card>
        <Text style={[T.tiny, { marginBottom: S.sm }]}>Player ratings</Text>
        <Row style={{ alignItems: 'flex-start' }} gap={S.lg}>
          {[match.home, match.away].map((team) => (
            <View key={team.id} style={{ flex: 1, gap: 6 }}>
              <Text style={[T.small, { color: C.text, fontWeight: '800' }]} numberOfLines={1}>
                {team.name}
              </Text>
              {ratings(team.id).map((p) => (
                <Row key={p.playerId} style={{ justifyContent: 'space-between' }}>
                  <Text style={[T.small, { flex: 1, color: C.text }]} numberOfLines={1}>
                    {shortName(nm(p.playerId))}
                  </Text>
                  <RatingBadge value={p.rating} mvp={p.playerId === f.mvpPlayerId} />
                </Row>
              ))}
            </View>
          ))}
        </Row>
      </Card>
      <Button label="CHIUDI" variant="dark" onPress={() => router.back()} />
    </Animated.View>
  );
}

/** PRE-MATCH: formations, coaches, strength, form and previous meetings. */
function PreMatch({ match, view, catalog }: { match: MatchView; view: LeagueView; catalog: Catalog }) {
  const teamInfo = (teamId: string) => {
    const t = view.teams.find((x) => x.id === teamId)!;
    const roster = t.roster ?? [];
    const players = roster.filter((r) => r.kind === 'player').map((r) => catalog.player(r.itemId));
    const coachId = roster.find((r) => r.kind === 'coach')?.itemId;
    const coach = coachId ? catalog.coach(coachId) : null;
    const row = view.standings.find((r) => r.teamId === teamId);
    return { t, players, coach, strength: strengthView(players, coach), form: row?.form ?? [] };
  };
  const home = teamInfo(match.home.id);
  const away = teamInfo(match.away.id);
  const h2h = (view.tournament?.matches ?? []).filter(
    (m) => m.status === 'finished' && m.id !== match.summary.id && ((m.homeTeamId === match.home.id && m.awayTeamId === match.away.id) || (m.homeTeamId === match.away.id && m.awayTeamId === match.home.id)),
  );
  return (
    <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 80 }}>
      <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center', gap: S.md }}>
        <Card>
          <Text style={[T.tiny, { marginBottom: S.md }]}>Confronto</Text>
          {(
            [
              ['Overall', home.strength.overall, away.strength.overall],
              ['Attacco', home.strength.attack, away.strength.attack],
              ['Centrocampo', home.strength.midfield, away.strength.midfield],
              ['Difesa', home.strength.defense, away.strength.defense],
              ['Portiere', home.strength.goalkeeper, away.strength.goalkeeper],
            ] as [string, number, number][]
          ).map(([label, x, y]) => (
            <Row key={label} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={[T.h3, T.number, { color: x >= y ? C.gold : C.textDim, width: 40 }]}>{x}</Text>
              <Text style={T.small}>{label}</Text>
              <Text style={[T.h3, T.number, { color: y >= x ? C.gold : C.textDim, width: 40, textAlign: 'right' }]}>{y}</Text>
            </Row>
          ))}
          <Row style={{ justifyContent: 'space-between', marginTop: S.sm }}>
            <FormDots form={home.form} />
            <Text style={T.small}>Forma</Text>
            <FormDots form={away.form} />
          </Row>
        </Card>
        {[home, away].map((side) => (
          <Card key={side.t.id}>
            <Row>
              <TeamBadge logo={side.t.logo} size={30} />
              <Text style={[T.h3, { flex: 1 }]}>{side.t.name}</Text>
            </Row>
            {side.coach ? (
              <Text style={[T.small, { marginTop: S.sm }]}>
                📋 {side.coach.name} · {TACTIC_IT[side.coach.preferredTactic]}
              </Text>
            ) : null}
            <View style={{ marginTop: S.sm, gap: 4 }}>
              {side.players.map((p) => (
                <Row key={p.id}>
                  <View style={[styles.posDot, { backgroundColor: SLOT_COLORS[p.position] }]}>
                    <Text style={styles.posText}>{SLOT_SHORT[p.position]}</Text>
                  </View>
                  <Text style={[T.body, { flex: 1 }]}>{p.name}</Text>
                  <Text style={[T.small, T.number]}>{p.overall}</Text>
                </Row>
              ))}
            </View>
          </Card>
        ))}
        <Card>
          <Text style={[T.tiny, { marginBottom: S.sm }]}>Scontri precedenti</Text>
          {h2h.length ? (
            h2h.map((m) => (
              <Text key={m.id} style={T.body}>
                {view.teams.find((t) => t.id === m.homeTeamId)?.name} {m.homeGoals}-{m.awayGoals} {view.teams.find((t) => t.id === m.awayTeamId)?.name}
              </Text>
            ))
          ) : (
            <Text style={T.small}>Primo incrocio stagionale: si scrive la storia.</Text>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}

function FormDots({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (!form.length) return <Text style={T.small}>—</Text>;
  return (
    <Row gap={3}>
      {form.map((f, i) => (
        <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f === 'W' ? C.green : f === 'L' ? C.red : C.textMute }} />
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  dressingRoom: { marginHorizontal: S.lg, marginBottom: S.md, paddingVertical: S.sm, paddingHorizontal: S.md, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  root: { flex: 1, backgroundColor: C.bg },
  scoreboard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.lg },
  score: { color: C.text, fontSize: 48, fontWeight: '900', letterSpacing: -1, ...T.number },
  clock: { color: C.red, fontWeight: '900', fontSize: 16, marginTop: 2, ...T.number },
  ctrl: { paddingHorizontal: 12, height: 34, borderRadius: R.pill, backgroundColor: C.cardHigh, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  ctrlText: { color: C.text, fontWeight: '900', fontSize: 13 },
  event: { backgroundColor: C.card, borderRadius: R.md, padding: S.md, borderLeftWidth: 3, borderLeftColor: C.border },
  eventKey: { backgroundColor: C.cardHigh },
  eventGoal: { borderWidth: 1, borderColor: C.gold, backgroundColor: '#211C0B' },
  minute: { color: C.textDim, fontWeight: '900', width: 44, ...T.number },
  statBar: { height: 6, borderRadius: 3 },
  lineRow: { paddingVertical: 4 },
  posDot: { width: 38, borderRadius: 5, paddingVertical: 2, alignItems: 'center' },
  posText: { color: '#0A0A0A', fontSize: 10, fontWeight: '900' },
  rating: { minWidth: 40, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  celebration: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,7,13,0.9)', alignItems: 'center', justifyContent: 'center', padding: S.xl },
  goalText: { fontSize: 64, fontWeight: '900', color: C.gold, letterSpacing: -2, textShadowColor: C.gold, textShadowRadius: 30 },
});
