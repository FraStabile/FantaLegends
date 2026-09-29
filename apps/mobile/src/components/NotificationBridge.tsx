import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { localClient, remoteClient, useSession } from '@/lib/store/session';
import { updateRemoteProfile } from '@/lib/net/remoteClient';
import { toast } from '@/lib/store/toasts';
import { haptic } from '@/lib/haptics';
import { ONLINE_ENABLED } from '@/lib/features';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Routes realtime notifications to in-app toasts, and registers the device for
 * Expo push notifications (delivered by the server when the user is offline).
 */
export function NotificationBridge() {
  const remote = useSession((s) => s.remote);
  const displayName = useSession((s) => s.displayName);

  useEffect(() => {
    if (!displayName) return;
    const show = (n: { kind: string; title: string; body: string }) => {
      if (n.kind === 'outbid') haptic.warning();
      else if (n.kind === 'match_result' || n.kind === 'champion') haptic.success();
      toast[n.kind === 'outbid' ? 'error' : n.kind === 'champion' || n.kind === 'sold' ? 'gold' : 'info'](n.title, n.body);
    };
    const offs = [localClient().onNotification(show)];
    const r = remoteClient();
    if (r) offs.push(r.onNotification((n) => n.kind !== 'sold' && show(n)));
    return () => offs.forEach((o) => o());
  }, [remote, displayName]);

  useEffect(() => {
    if (!ONLINE_ENABLED || !remote || Platform.OS === 'web') return;
    void (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) return; // push requires an EAS project id (see README)
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        await updateRemoteProfile(remote.serverUrl, remote.token, { pushToken: data });
      } catch {
        /* simulators / Expo Go without push support */
      }
    })();
  }, [remote]);

  return null;
}
