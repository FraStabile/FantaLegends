import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import type { CatalogItem, LotResult, TeamLogo } from '@asta/core';
import { TeamBadge } from '@/components/ui';
import { C, S, T } from '@/lib/theme';

/** Short celebratory screen after each lot: "SOLD! Messi → Francesco FC → 52 crediti". */
export function SoldOverlay({ result, item, teamName, logo, mine }: { result: LotResult; item: CatalogItem; teamName: string | null; logo: TeamLogo | null; mine: boolean }) {
  const sold = !!result.teamId || (result.price > 0 && !teamName);
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={styles.overlay} pointerEvents="none">
      <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignItems: 'center' }}>
        <Text style={[styles.title, { color: sold ? (mine ? C.green : C.gold) : C.textDim }]} numberOfLines={1} adjustsFontSizeToFit>{sold ? (mine ? 'TUO!' : 'SOLD!') : 'INVENDUTO'}</Text>
        <Text style={styles.player}>{item.name}</Text>
        {sold ? (
          <View style={{ alignItems: 'center', marginTop: S.lg, gap: S.sm }}>
            {logo ? <TeamBadge logo={logo} size={56} /> : null}
            <Text style={[T.h2, { color: C.text }]}>→ {teamName ?? 'Offerente nascosto'}</Text>
            <Text style={[T.h1, { color: C.gold, ...T.number }]}>→ {result.price} {result.price === 1 ? 'credito' : 'crediti'}</Text>
          </View>
        ) : (
          <Text style={[T.body, { color: C.textDim, marginTop: S.md }]}>Nessuna offerta: tornerà più tardi</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: S.xl },
  title: { fontSize: 64, maxWidth: '100%', fontWeight: '900', letterSpacing: -2, textShadowColor: 'rgba(212,175,55,0.5)', textShadowRadius: 24 },
  player: { color: C.text, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: S.sm },
});
