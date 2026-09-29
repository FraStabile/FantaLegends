import React from 'react';
import { router } from 'expo-router';
import { useSession } from '@/lib/store/session';
import { Button, EmptyState, Screen } from '@/components/ui';
import { SeasonScreen } from '@/components/season/SeasonScreen';

/**
 * Championship tab for the active league. The "championship not started yet"
 * state (lobby / auction / pre-season) is handled inside SeasonScreen so the
 * league is subscribed only once.
 */
export default function SeasonTab() {
  const activeLeagueId = useSession((s) => s.activeLeagueId);
  if (!activeLeagueId) {
    return (
      <Screen>
        <EmptyState
          emoji="🏆"
          title="Nessuna lega selezionata"
          body="Scegli una lega per vedere classifica, calendario e chi sta dominando la stagione."
          action={<Button variant="gold" label="LE MIE LEGHE" onPress={() => router.push('/(tabs)/leagues')} />}
        />
      </Screen>
    );
  }
  return <SeasonScreen key={activeLeagueId} leagueId={activeLeagueId} />;
}
