import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep link target: astalegends://join/CODE */
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={`/league/join?code=${encodeURIComponent(String(code ?? ''))}`} />;
}
