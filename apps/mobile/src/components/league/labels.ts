import { C } from '@/lib/theme';

export const STATUS_IT: Record<string, { label: string; color: string; emoji: string }> = {
  lobby: { label: 'Lobby aperta', color: C.cyan, emoji: '🚪' },
  auction: { label: 'Asta in corso', color: C.gold, emoji: '🔨' },
  pre_season: { label: 'Asta conclusa', color: C.purple, emoji: '📋' },
  season: { label: 'Campionato', color: C.green, emoji: '⚽' },
  completed: { label: 'Stagione conclusa', color: C.textDim, emoji: '🏆' },
};

export function statusInfo(status: string) {
  return STATUS_IT[status] ?? { label: status, color: C.textDim, emoji: '•' };
}

/** Extracts an invite code from "astalegends://join/X7K92P", a URL ending in /join/CODE, or a raw code. */
export function parseInviteCode(raw: string): string | null {
  const text = raw.trim();
  const m = text.match(/join\/([A-Za-z0-9]{4,8})/i);
  const candidate = (m ? m[1] : text).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return candidate.length === 6 ? candidate : null;
}
