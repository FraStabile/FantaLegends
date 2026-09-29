import { useEffect } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * Keeps the screen on during the auction and live matches. Failures are ignored:
 * on web the Wake Lock API may be unavailable or not yet granted.
 */
export function useScreenAwake(tag: string): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = false;
    activateKeepAwakeAsync(tag)
      .then(() => (active = true))
      .catch(() => {});
    return () => {
      if (active) void Promise.resolve(deactivateKeepAwake(tag)).catch(() => {});
    };
  }, [tag]);
}
