import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ONLINE_ENABLED } from '@/lib/features';

/** Deep link target: astalegends://join/CODE */
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  if (!ONLINE_ENABLED) return <Redirect href="/" />;
  return <Redirect href={`/league/join?code=${encodeURIComponent(String(code ?? ''))}`} />;
}
