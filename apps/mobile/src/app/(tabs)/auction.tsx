import { router } from 'expo-router';
import { AuctionScreen } from '@/components/auction/AuctionScreen';
import { Button, EmptyState, Screen } from '@/components/ui';
import { useSession } from '@/lib/store/session';
import { ONLINE_ENABLED } from '@/lib/features';

export default function AuctionTab() {
  const leagueId = useSession((s) => s.activeLeagueId);
  if (!leagueId) {
    return (
      <Screen>
        <EmptyState emoji="🔨" title="Nessuna asta attiva" body={ONLINE_ENABLED ? 'Crea una lega, entra con un codice o prova la Demo Auction con i bot.' : 'Crea una lega o prova la Demo Auction con i bot.'} action={<Button label="VAI ALLE LEGHE" variant="gold" onPress={() => router.push('/leagues')} />} />
      </Screen>
    );
  }
  return <AuctionScreen leagueId={leagueId} />;
}
