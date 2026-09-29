import { useLocalSearchParams } from 'expo-router';
import { MatchCenter } from '@/components/match/MatchCenter';

export default function MatchRoute() {
  const { leagueId, matchId } = useLocalSearchParams<{ leagueId: string; matchId: string }>();
  return <MatchCenter leagueId={leagueId} matchId={matchId} />;
}
