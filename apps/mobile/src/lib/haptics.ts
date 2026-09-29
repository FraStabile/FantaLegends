import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSession } from './store/session';

const enabled = () => Platform.OS !== 'web' && useSession.getState().hapticsEnabled;

/** Haptic vocabulary of the game. No-ops on web or when disabled in the profile. */
export const haptic = {
  tap: () => enabled() && void Haptics.selectionAsync().catch(() => {}),
  bid: () => enabled() && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => enabled() && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => enabled() && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => enabled() && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => enabled() && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
