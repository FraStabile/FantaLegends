import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { CatalogItem, Slot, TeamLogo } from '@asta/core';
import { C, R, RARITY_COLORS, S, SLOT_COLORS, T } from '@/lib/theme';
import { SLOT_SHORT } from '@/lib/format';
import { haptic } from '@/lib/haptics';

// ───────────────────────────── layout

export function Screen({ children, scroll = true, edges = ['top'], padded = true, contentStyle }: { children: ReactNode; scroll?: boolean; edges?: Edge[]; padded?: boolean; contentStyle?: StyleProp<ViewStyle> }) {
  const inner = padded ? [styles.screenPad, contentStyle] : contentStyle;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <LinearGradient colors={['#0B1830', C.bg, C.bg]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.maxWidth}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>
          <View style={[styles.maxWidth, { flex: 1 }]}>{children}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right, kicker }: { title: string; subtitle?: string; right?: ReactNode; kicker?: string }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={[T.tiny, { color: C.gold }]}>{kicker}</Text> : null}
        <Text style={T.h1} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={[T.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Section({ title, right, children, style }: { title: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: S.xl }, style]}>
      <View style={styles.sectionHead}>
        <Text style={T.tiny}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style, onPress, highlight }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; highlight?: boolean }) {
  const body = <View style={[styles.card, highlight && styles.cardHighlight, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}>
      {body}
    </Pressable>
  );
}

export function Row({ children, style, gap = S.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// ───────────────────────────── controls

type ButtonVariant = 'gold' | 'primary' | 'ghost' | 'danger' | 'dark';

export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, small, style }: { label: string; onPress?: () => void; variant?: ButtonVariant; disabled?: boolean; loading?: boolean; icon?: string; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg: Record<ButtonVariant, string> = { gold: C.gold, primary: C.blue, ghost: 'transparent', danger: C.red, dark: C.cardHigh };
  const fg = variant === 'gold' ? '#1A1405' : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg[variant], borderColor: variant === 'ghost' ? C.borderStrong : 'transparent' },
        (disabled || loading) && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: fg }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function TextField({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: S.md }}>
      {label ? <Text style={[T.tiny, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput placeholderTextColor={C.textMute} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function Stepper({ label, value, onChange, min, max, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  const set = (v: number) => {
    haptic.tap();
    onChange(Math.max(min, Math.min(max, v)));
  };
  return (
    <View style={styles.formRow}>
      <Text style={[T.body, { flex: 1 }]}>{label}</Text>
      <Row gap={S.xs}>
        <Pressable onPress={() => set(value - step)} style={styles.stepBtn} disabled={value <= min} accessibilityRole="button" accessibilityLabel={`Diminuisci ${label}`}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={[T.h3, T.number, { minWidth: 54, textAlign: 'center' }]}>
          {value}
          {suffix ?? ''}
        </Text>
        <Pressable onPress={() => set(value + step)} style={styles.stepBtn} disabled={value >= max} accessibilityRole="button" accessibilityLabel={`Aumenta ${label}`}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </Row>
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.formRow}>
      <View style={{ flex: 1 }}>
        <Text style={T.body}>{label}</Text>
        {hint ? <Text style={T.small}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={(v) => { haptic.tap(); onChange(v); }} trackColor={{ true: C.gold, false: C.border }} thumbColor={C.text} />
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, wrap }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; wrap?: boolean }) {
  return (
    <View style={[styles.segmented, wrap && { flexWrap: 'wrap' }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={[styles.segment, wrap && { flexGrow: 1, flexBasis: '30%' }, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && { color: '#1A1405' }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} style={[styles.chip, active && { backgroundColor: color ?? C.gold, borderColor: color ?? C.gold }]}>
      <Text style={[styles.chipText, active && { color: '#0A0A0A' }]}>{label}</Text>
    </Pressable>
  );
}

// ───────────────────────────── game atoms

export function Pill({ label, color = C.gold, solid }: { label: string; color?: string; solid?: boolean }) {
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: solid ? color : `${color}22` }]}>
      <Text style={[styles.pillText, { color: solid ? '#0A0A0A' : color }]}>{label}</Text>
    </View>
  );
}

export function SlotBadge({ slot }: { slot: Slot }) {
  return (
    <View style={[styles.slotBadge, { backgroundColor: `${SLOT_COLORS[slot]}26`, borderColor: SLOT_COLORS[slot] }]}>
      <Text style={[styles.slotText, { color: SLOT_COLORS[slot] }]}>{SLOT_SHORT[slot]}</Text>
    </View>
  );
}

export function OvrBadge({ value, rarity, size = 'md' }: { value: number; rarity: CatalogItem['rarity']; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 64 : size === 'sm' ? 32 : 44;
  const color = RARITY_COLORS[rarity];
  return (
    <View style={[styles.ovr, { width: dim, height: dim, borderColor: color, backgroundColor: `${color}1F` }]}>
      <Text style={{ color, fontWeight: '900', fontSize: size === 'lg' ? 26 : size === 'sm' ? 13 : 17, ...T.number }}>{value}</Text>
    </View>
  );
}

export function TeamBadge({ logo, size = 36 }: { logo: TeamLogo; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${logo.color}33`, borderWidth: 2, borderColor: logo.color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{logo.emoji}</Text>
    </View>
  );
}

export function Avatar({ emoji, size = 36, online }: { emoji: string; size?: number; online?: boolean }) {
  return (
    <View>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.cardHigh, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border }}>
        <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text>
      </View>
      {online !== undefined ? <View style={[styles.presence, { backgroundColor: online ? C.green : C.textMute }]} /> : null}
    </View>
  );
}

export function StatBar({ label, value, max = 99, color = C.gold }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const c = value >= 85 ? C.green : value >= 70 ? color : value >= 50 ? C.orange : C.red;
  return (
    <View style={{ marginBottom: 8 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={T.small}>{label}</Text>
        <Text style={[T.small, T.number, { color: C.text, fontWeight: '800' }]}>{value}</Text>
      </Row>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: c }]} />
      </View>
    </View>
  );
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text style={[T.h2, { textAlign: 'center', marginTop: S.md }]}>{title}</Text>
      {body ? <Text style={[T.small, { textAlign: 'center', marginTop: S.sm }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: S.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function ItemRow({ item, right, onPress, subtitle }: { item: CatalogItem; right?: ReactNode; onPress?: () => void; subtitle?: string }) {
  const slot: Slot = item.kind === 'coach' ? 'COACH' : item.position;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.itemRow, pressed && { opacity: 0.8 }]}>
      <SlotBadge slot={slot} />
      <View style={{ flex: 1 }}>
        <Text style={T.h3} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={T.small} numberOfLines={1}>
          {subtitle ?? `${item.nationality} · Prime ${item.primePeriod}${item.kind === 'player' ? ` · ${item.historicalClub}` : ''}`}
        </Text>
      </View>
      <OvrBadge value={item.overall} rarity={item.rarity} size="sm" />
      {right}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: S.md }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  screenPad: { paddingHorizontal: S.lg, paddingTop: S.md },
  maxWidth: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: S.lg, borderWidth: 1, borderColor: C.border },
  cardHighlight: { borderColor: C.gold, backgroundColor: '#15203A' },
  button: { height: 52, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg, borderWidth: 1 },
  buttonSmall: { height: 38, borderRadius: R.sm, paddingHorizontal: S.md },
  buttonText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  input: { backgroundColor: C.bgElevated, borderRadius: R.md, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: S.lg, height: 50, fontSize: 16, fontWeight: '600' },
  formRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: S.md },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cardHigh, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  stepText: { color: C.gold, fontSize: 20, fontWeight: '900' },
  segmented: { flexDirection: 'row', backgroundColor: C.bgElevated, borderRadius: R.md, padding: 4, gap: 4, borderWidth: 1, borderColor: C.border },
  segment: { flex: 1, paddingVertical: 9, borderRadius: R.sm, alignItems: 'center', paddingHorizontal: 6 },
  segmentActive: { backgroundColor: C.gold },
  segmentText: { color: C.textDim, fontWeight: '800', fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, borderWidth: 1, borderColor: C.borderStrong, marginRight: 6, marginBottom: 6 },
  chipText: { color: C.textDim, fontWeight: '700', fontSize: 13 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  slotBadge: { width: 42, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  slotText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  ovr: { borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  presence: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.card },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: C.bgElevated, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', padding: S.xl, marginTop: S.xl },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
});
