import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToasts } from '@/lib/store/toasts';
import { C, R, S } from '@/lib/theme';

const TONE = { info: C.blue, success: C.green, error: C.red, gold: C.gold } as const;

/** In-app notifications ("Sei stato superato!", "Hai vinto 3-2!") and error feedback. */
export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {toasts.map((t) => (
        <Animated.View key={t.id} entering={FadeInUp.springify()} exiting={FadeOutUp} style={[styles.toast, { borderLeftColor: TONE[t.tone] }]}>
          <Pressable onPress={() => dismiss(t.id)}>
            <Text style={styles.title}>{t.title}</Text>
            {t.body ? <Text style={styles.body}>{t.body}</Text> : null}
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: S.md, right: S.md, gap: S.sm, zIndex: 1000, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: C.cardHigh,
    borderRadius: R.md,
    padding: S.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  title: { color: C.text, fontWeight: '900', fontSize: 15 },
  body: { color: C.textDim, fontSize: 13, marginTop: 2 },
});
