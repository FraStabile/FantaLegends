import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, T } from '@/lib/theme';
import { countdown } from '@/lib/format';

/** Circular countdown driven by the authoritative deadline (endsAt on the server clock). */
export function TimerRing({ remainingMs, totalMs, size = 96, paused }: { remainingMs: number; totalMs: number; size?: number; paused?: boolean }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, remainingMs / Math.max(1, totalMs)));
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const color = paused ? C.textMute : secs <= 3 ? C.red : secs <= 5 ? C.orange : C.gold;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[T.number, { color, fontSize: size * 0.22, fontWeight: '900' }]}>{paused ? '⏸' : countdown(remainingMs)}</Text>
      </View>
    </View>
  );
}
