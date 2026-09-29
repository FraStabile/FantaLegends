import { useEffect } from 'react';
import { View } from 'react-native';
import { DarkTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { C } from '@/lib/theme';
import { useSession } from '@/lib/store/session';
import { ToastHost } from '@/components/ToastHost';
import { NotificationBridge } from '@/components/NotificationBridge';

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bgElevated, primary: C.gold, text: C.text, border: C.border } };

export default function RootLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const displayName = useSession((s) => s.displayName);
  const segments = useSegments();

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync().catch(() => {});
    const inOnboarding = segments[0] === 'onboarding';
    if (!displayName && !inOnboarding) router.replace('/onboarding');
  }, [hydrated, displayName, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            {hydrated ? (
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                <Stack.Screen name="match/[leagueId]/[matchId]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="player/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              </Stack>
            ) : null}
            <NotificationBridge />
            <ToastHost />
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
