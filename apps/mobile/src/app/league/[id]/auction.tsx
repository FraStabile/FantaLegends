import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AuctionScreen } from '@/components/auction/AuctionScreen';
import { useSession } from '@/lib/store/session';

export default function LeagueAuction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const setActive = useSession((s) => s.setActiveLeague);
  useEffect(() => setActive(id), [id, setActive]);
  return <AuctionScreen leagueId={id} />;
}
