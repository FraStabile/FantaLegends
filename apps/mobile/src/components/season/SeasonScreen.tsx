import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useLeague } from '@/lib/hooks/useLeague';
import { C, S } from '@/lib/theme';
import { FORMAT_IT } from '@/lib/format';
import { Button, EmptyState, Header, Pill, Screen, Segmented } from '@/components/ui';
import { teamMap } from './shared';
import { StandingsTab } from './StandingsTab';
import { CalendarTab } from './CalendarTab';
import { StatsTab } from './StatsTab';
import { AwardsTab, HistoryTab } from './AwardsTab';
import { TeamTalkCard } from './TeamTalkCard';

type Tab = 'standings' | 'calendar' | 'stats' | 'awards' | 'history';

const TABS: { value: Tab; label: string }[] = [
  { value: 'standings', label: 'CLASSIFICA' },
  { value: 'calendar', label: 'CALENDARIO' },
  { value: 'stats', label: 'STATISTICHE' },
  { value: 'awards', label: 'PREMI' },
  { value: 'history', label: "ALBO D'ORO" },
];

export function SeasonScreen({ leagueId }: { leagueId: string }) {
  const handle = useLeague(leagueId);
  const { view, catalog, myTeam } = handle;
  const [tab, setTab] = useState<Tab>('standings');
  const teams = useMemo(() => teamMap(view?.teams ?? []), [view?.teams]);

  if (!view) {
    return (
      <Screen scroll={false}>
        {handle.error ? (
          <EmptyState emoji="📡" title="Lega non raggiungibile" body={handle.error} action={<Button label="Le mie leghe" variant="dark" onPress={() => router.push('/(tabs)/leagues')} />} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.gold} size="large" />
          </View>
        )}
      </Screen>
    );
  }

  if (view.status === 'lobby' || view.status === 'auction' || view.status === 'pre_season') {
    const body =
      view.status === 'pre_season'
        ? "L'asta è chiusa e le rose sono pronte: manca solo il fischio d'inizio del Master."
        : "Prima si fa mercato, poi si scende in campo: il campionato parte subito dopo l'asta.";
    return (
      <Screen>
        <Header kicker={`Stagione ${view.season}`} title={view.config.name} subtitle={FORMAT_IT[view.config.format]} />
        <EmptyState
          emoji={view.status === 'pre_season' ? '⏱️' : '🔨'}
          title="Il campionato non è ancora iniziato"
          body={body}
          action={<Button variant="gold" label="VAI ALLA LEGA" onPress={() => router.push(`/league/${view.id}`)} />}
        />
      </Screen>
    );
  }

  const t = view.tournament;
  const phaseLabel = t?.phase === 'completed' ? 'CONCLUSO' : t?.phase === 'playoffs' ? 'PLAYOFF' : t ? `GIORNATA ${t.currentRound}/${t.totalRounds}` : null;
  const hasLive = !!t?.matches.some((m) => m.status === 'live');

  return (
    <Screen>
      <Header
        kicker={`Stagione ${view.season} · ${FORMAT_IT[view.config.format]}`}
        title={view.config.name}
        subtitle={myTeam ? `La tua squadra: ${myTeam.name}` : undefined}
        right={hasLive ? <Pill label="● LIVE" color={C.red} solid /> : phaseLabel ? <Pill label={phaseLabel} color={t?.phase === 'completed' ? C.gold : C.cyan} /> : null}
      />
      <TeamTalkCard view={view} />
      <View style={{ marginTop: S.sm }}>
        <Segmented options={TABS} value={tab} onChange={setTab} wrap />
      </View>
      {tab === 'standings' ? <StandingsTab view={view} teams={teams} myTeamId={myTeam?.id ?? null} leagueId={leagueId} /> : null}
      {tab === 'calendar' ? (
        <View style={{ marginTop: S.md }}>
          <CalendarTab view={view} teams={teams} handle={handle} leagueId={leagueId} />
        </View>
      ) : null}
      {tab === 'stats' ? <StatsTab view={view} teams={teams} catalog={catalog} leagueId={leagueId} myTeamId={myTeam?.id ?? null} /> : null}
      {tab === 'awards' ? <AwardsTab view={view} teams={teams} catalog={catalog} leagueId={leagueId} /> : null}
      {tab === 'history' ? <HistoryTab view={view} teams={teams} catalog={catalog} /> : null}
    </Screen>
  );
}
