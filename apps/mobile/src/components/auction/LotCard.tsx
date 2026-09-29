import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CatalogItem, Coach, Player } from '@asta/core';
import { OvrBadge, Pill, Row, SlotBadge } from '@/components/ui';
import { C, R, RARITY_COLORS, S, T } from '@/lib/theme';
import { SLOT_IT, STYLE_IT, TACTIC_IT } from '@/lib/format';

function faceStats(p: Player): [string, number][] {
  const s = p.stats;
  if (p.position === 'GK') return [['TUF', s.diving], ['PRE', s.handling], ['RIF', s.reflexes], ['POS', s.positioning], ['RIN', s.kicking], ['VEL', s.pace]];
  return [['VEL', s.pace], ['TIR', s.shooting], ['PAS', s.passing], ['DRI', s.dribbling], ['DIF', s.defending], ['FIS', s.physical]];
}

function coachHighlights(c: Coach): [string, number][] {
  const labels: Record<keyof Coach['modifiers'], string> = {
    possession: 'Possesso', passing: 'Passaggi', pressing: 'Pressing', defense: 'Difesa', counter: 'Contropiede', attack: 'Attacco',
    leadManagement: 'Gest. vantaggio', deficitManagement: 'Gest. svantaggio', adaptability: 'Adattabilità', motivation: 'Motivazione',
  };
  return (Object.entries(c.modifiers) as [keyof Coach['modifiers'], number][])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([k, v]) => [labels[k], v]);
}

/** The hero card of the current lot. */
export function LotCard({ item, lotNumber }: { item: CatalogItem; lotNumber: number }) {
  const slot = item.kind === 'coach' ? 'COACH' : item.position;
  const glow = RARITY_COLORS[item.rarity];
  return (
    <View style={[styles.card, { borderColor: glow, shadowColor: glow }]}>
      <LinearGradient colors={[`${glow}33`, C.card, C.card]} style={StyleSheet.absoluteFill} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[T.tiny, { color: C.gold }]}>LOTTO #{lotNumber}</Text>
        <Pill label={item.rarity.toUpperCase()} color={glow} />
      </Row>
      <Row style={{ marginTop: S.md, alignItems: 'flex-start' }} gap={S.md}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
            {item.name}
          </Text>
          <Text style={[T.small, { color: C.text, marginTop: 2 }]}>Prime {item.primePeriod}</Text>
          <Row style={{ marginTop: S.sm }} gap={6}>
            <SlotBadge slot={slot} />
            <Text style={[T.h3, { color: C.textDim }]}>{SLOT_IT[slot].toUpperCase()}</Text>
          </Row>
          <Text style={[T.small, { marginTop: 6 }]} numberOfLines={1}>
            {item.nationality}
            {item.kind === 'player' ? ` · ${item.historicalClub} · ${STYLE_IT[item.playStyle]}` : ` · ${TACTIC_IT[item.preferredTactic]}`}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <OvrBadge value={item.overall} rarity={item.rarity} size="lg" />
          <Text style={[T.tiny, { marginTop: 4 }]}>OVR</Text>
        </View>
      </Row>
      <View style={styles.stats}>
        {item.kind === 'player'
          ? faceStats(item).map(([k, v]) => (
              <View key={k} style={styles.stat}>
                <Text style={[styles.statValue, { color: v >= 85 ? C.green : v >= 70 ? C.text : C.textDim }]}>{v}</Text>
                <Text style={styles.statLabel}>{k}</Text>
              </View>
            ))
          : coachHighlights(item).map(([k, v]) => (
              <View key={k} style={[styles.stat, { minWidth: '45%' }]}>
                <Text style={[styles.statValue, { color: v > 0 ? C.green : v < 0 ? C.red : C.textDim }]}>{v > 0 ? `+${v}` : v}</Text>
                <Text style={styles.statLabel}>{k}</Text>
              </View>
            ))}
      </View>
      {item.kind === 'coach' ? <Text style={[T.small, { marginTop: S.sm, fontStyle: 'italic' }]}>“{item.style}”</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, borderWidth: 2, padding: S.lg, overflow: 'hidden', backgroundColor: C.card, shadowOpacity: 0.45, shadowRadius: 22, elevation: 10 },
  name: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: S.lg, gap: 6 },
  stat: { flexGrow: 1, minWidth: '14%', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: R.sm, paddingVertical: 6 },
  statValue: { fontSize: 18, fontWeight: '900', ...T.number },
  statLabel: { color: C.textMute, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
