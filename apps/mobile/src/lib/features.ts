/**
 * Feature flags.
 *
 * Online play (server, invites, join by code/QR) is work in progress: it stays
 * hidden from users unless the build sets EXPO_PUBLIC_ONLINE_ENABLED=true.
 */
export const ONLINE_ENABLED = process.env.EXPO_PUBLIC_ONLINE_ENABLED === 'true';
