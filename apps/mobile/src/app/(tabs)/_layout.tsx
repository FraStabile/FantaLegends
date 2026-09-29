import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S } from '@/lib/theme';
import { haptic } from '@/lib/haptics';

const TABS: Record<string, { label: string; icon: string }> = {
  index: { label: 'HOME', icon: '🏠' },
  leagues: { label: 'LEGHE', icon: '🏟️' },
  auction: { label: 'ASTA', icon: '🔨' },
  season: { label: 'CAMPIONATO', icon: '🏆' },
  profile: { label: 'PROFILO', icon: '👤' },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="leagues" />
      <Tabs.Screen name="auction" />
      <Tabs.Screen name="season" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = TABS[route.name];
        if (!tab) return null;
        const center = route.name === 'auction';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              haptic.tap();
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.item}>
            <View style={[center ? styles.centerIcon : styles.icon, focused && !center && styles.iconActive, center && focused && { borderColor: C.goldBright }]}>
              <Text style={{ fontSize: center ? 24 : 19, opacity: focused || center ? 1 : 0.55 }}>{tab.icon}</Text>
            </View>
            <Text style={[styles.label, focused && { color: C.gold }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: 'rgba(8,12,22,0.98)', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, paddingHorizontal: S.xs },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  icon: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: `${C.gold}22` },
  centerIcon: { width: 54, height: 54, borderRadius: 27, marginTop: -24, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg, shadowColor: C.gold, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  label: { color: C.textMute, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
});
