import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import type { ConnectionStatus } from '@/lib/net/types';
import { C, R, S } from '@/lib/theme';

/** "Connessione persa" banner while the socket reconnects (the snapshot is re-synced automatically). */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === 'online') return null;
  const label = status === 'connecting' ? 'Connessione in corso…' : status === 'reconnecting' ? 'Connessione persa — riconnessione…' : 'Server non raggiungibile';
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.banner}>
      <ActivityIndicator color={C.text} size="small" />
      <Text style={styles.text}>{label}</Text>
      <View style={{ flex: 1 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: '#7F1D1D', borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 8, marginBottom: S.md, borderWidth: 1, borderColor: C.red },
  text: { color: C.text, fontWeight: '800', fontSize: 13 },
});
