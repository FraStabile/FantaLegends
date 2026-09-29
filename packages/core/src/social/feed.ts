import type { FeedItem, FeedKind, League, LotResult, MatchSummary } from '../domain/types';
import { Catalog } from '../catalog/catalog';
import { DomainError } from '../domain/errors';
import type { DomainEvent } from '../events/types';
import { referencePrice } from '../bots/botBrain';

export const MAX_FEED_ITEMS = 200;
export const FEED_REACTIONS = ['🔥', '😂', '😱', '👏', '💸', '🤡'] as const;

let feedCounter = 0;
function feedId(now: number): string {
  feedCounter = (feedCounter + 1) % 1_000_000;
  return `f-${now.toString(36)}-${feedCounter.toString(36)}`;
}

export function postFeed(league: League, kind: FeedKind, emoji: string, text: string, now: number): DomainEvent {
  const item: FeedItem = { id: feedId(now), kind, emoji, text, at: now, reactions: {}, comments: [] };
  league.feed.unshift(item);
  if (league.feed.length > MAX_FEED_ITEMS) league.feed.length = MAX_FEED_ITEMS;
  return { type: 'FeedPosted', item };
}

const ownerName = (league: League, teamId: string | null) => {
  const team = league.teams.find((t) => t.id === teamId);
  return league.members.find((m) => m.userId === team?.ownerId)?.displayName ?? team?.name ?? '—';
};
const teamName = (league: League, teamId: string | null) => league.teams.find((t) => t.id === teamId)?.name ?? '—';

/** Social line for a sold lot: flags overpays and bargains so friends can roast each other. */
export function purchaseFeed(league: League, result: LotResult, now: number): DomainEvent | null {
  if (!result.teamId) return null;
  const catalog = new Catalog(league.customItems);
  const item = catalog.get(result.itemId);
  const who = ownerName(league, result.teamId);
  const ref = referencePrice(item, league, catalog);
  if (result.autoAssigned) return postFeed(league, 'purchase', '📋', `${item.name} assegnato d'ufficio a ${who} per ${result.price} ${result.price === 1 ? 'credito' : 'crediti'}`, now);
  if (result.price >= Math.max(8, ref * 1.8) && item.overall < 86) {
    return postFeed(league, 'overpay', '😂', `${who} ha speso ${result.price} crediti per ${item.name}`, now);
  }
  if (item.overall >= 86 && result.price <= Math.max(2, ref * 0.5)) {
    return postFeed(league, 'bargain', '🤑', `Colpaccio di ${who}: ${item.name} (${item.overall}) per soli ${result.price} crediti`, now);
  }
  const hot = result.price >= league.config.startingCredits * 0.25;
  return postFeed(league, 'purchase', hot ? '🔥' : '✅', `${who} ha acquistato ${item.name} per ${result.price} ${result.price === 1 ? 'credito' : 'crediti'}`, now);
}

export function matchFeed(league: League, m: MatchSummary, now: number): DomainEvent {
  const h = teamName(league, m.homeTeamId);
  const a = teamName(league, m.awayTeamId);
  const hg = m.homeGoals ?? 0;
  const ag = m.awayGoals ?? 0;
  const pens = m.homePens !== null ? ` (${m.homePens}-${m.awayPens} d.c.r.)` : '';
  if (hg === ag && !pens) return postFeed(league, 'match_result', '🤝', `${h} e ${a} pareggiano ${hg}-${ag}`, now);
  const homeWins = hg > ag || (hg === ag && (m.homePens ?? 0) > (m.awayPens ?? 0));
  const [w, l, wg, lg] = homeWins ? [h, a, hg, ag] : [a, h, ag, hg];
  const verb = wg - lg >= 3 ? 'travolge' : wg - lg === 2 ? 'batte' : 'supera di misura';
  return postFeed(league, 'match_result', '⚽', `${w} ${verb} ${l} ${wg}-${lg}${pens}`, now);
}

export function react(league: League, feedIdValue: string, userId: string, emoji: string): void {
  if (!(FEED_REACTIONS as readonly string[]).includes(emoji)) throw new DomainError('INVALID_INPUT');
  const item = league.feed.find((f) => f.id === feedIdValue);
  if (!item) throw new DomainError('NOT_FOUND');
  const list = item.reactions[emoji] ?? [];
  // toggle
  item.reactions[emoji] = list.includes(userId) ? list.filter((u) => u !== userId) : [...list, userId];
  if (item.reactions[emoji].length === 0) delete item.reactions[emoji];
}

export function comment(league: League, feedIdValue: string, userId: string, text: string, now: number): void {
  const clean = text.trim().slice(0, 280);
  if (!clean) throw new DomainError('INVALID_INPUT');
  const item = league.feed.find((f) => f.id === feedIdValue);
  if (!item) throw new DomainError('NOT_FOUND');
  item.comments.push({ id: feedId(now), userId, text: clean, at: now });
  if (item.comments.length > 50) item.comments.splice(0, item.comments.length - 50);
}
