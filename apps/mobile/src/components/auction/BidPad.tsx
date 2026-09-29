import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Row } from '@/components/ui';
import { C, R, S, T } from '@/lib/theme';
import { haptic } from '@/lib/haptics';

export interface BidPadProps {
  currentBid: number;
  hasLeader: boolean;
  minNextBid: number;
  maxBid: number;
  disabledReason: string | null;
  pending: boolean;
  onBid: (amount: number) => void;
}

const STEPS = [1, 2, 5, 10];

/**
 * Bid buttons. The pad only *proposes* an amount: validation happens on the
 * server, the UI just avoids sending bids that are certainly invalid.
 */
export function BidPad({ currentBid, hasLeader, minNextBid, maxBid, disabledReason, pending, onBid }: BidPadProps) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const base = hasLeader ? currentBid : 0;
  const amountFor = (step: number) => Math.max(minNextBid, base + step);

  return (
    <View>
      <Text style={styles.reason} numberOfLines={1}>
        {disabledReason ?? `Puoi offrire fino a ${maxBid}`}
      </Text>
      <View style={styles.grid}>
        {STEPS.map((step) => {
          const amount = amountFor(step);
          const disabled = !!disabledReason || pending || amount > maxBid;
          return (
            <Pressable
              key={step}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Rilancia di ${step}: offri ${amount}`}
              onPress={() => {
                haptic.bid();
                onBid(amount);
              }}
              style={({ pressed }) => [styles.btn, step === 10 && styles.btnHot, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.94 }] }]}>
              <Text style={[styles.step, step === 10 && { color: '#1A1405' }]}>+{step}</Text>
              <Text style={[styles.amount, step === 10 && { color: '#3D2F08' }]}>{amount}</Text>
            </Pressable>
          );
        })}
      </View>
      {showCustom ? (
        <Row style={{ marginTop: S.sm }}>
          <TextInput
            value={custom}
            onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={`min ${minNextBid} · max ${maxBid}`}
            placeholderTextColor={C.textMute}
            style={styles.input}
            autoFocus
          />
          <Button
            label="OFFRI"
            variant="gold"
            small
            disabled={!custom || !!disabledReason || pending}
            onPress={() => {
              const amount = Number(custom);
              haptic.bid();
              onBid(amount);
              setCustom('');
              setShowCustom(false);
            }}
            style={{ height: 50, paddingHorizontal: S.md, flexShrink: 0 }}
          />
        </Row>
      ) : (
        <Pressable onPress={() => setShowCustom(true)} style={styles.customLink} disabled={!!disabledReason}>
          <Text style={[T.small, { color: disabledReason ? C.textMute : C.gold, fontWeight: '800' }]}>OFFERTA PERSONALIZZATA</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: S.sm },
  btn: { flex: 1, height: 72, borderRadius: R.md, backgroundColor: C.cardHigh, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
  btnHot: { backgroundColor: C.gold, borderColor: C.goldBright },
  step: { color: C.gold, fontSize: 24, fontWeight: '900', ...T.number },
  amount: { color: C.textDim, fontSize: 12, fontWeight: '800', ...T.number },
  reason: { height: 20, color: C.textDim, textAlign: 'center', fontWeight: '700', marginBottom: S.sm, fontSize: 13 },
  customLink: { alignItems: 'center', paddingVertical: S.md },
  input: { flex: 1, minWidth: 0, height: 50, borderRadius: R.md, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.gold, color: C.text, fontSize: 20, fontWeight: '900', paddingHorizontal: S.lg, ...T.number },
});
