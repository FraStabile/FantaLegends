import { Catalog, type DomainEvent, type LeagueHost } from '@asta/core';
import type { UserRepository } from '../db/userRepository.js';

export interface AppNotification {
  kind: 'auction_started' | 'outbid' | 'bid' | 'sold' | 'match_soon' | 'match_result' | 'champion';
  title: string;
  body: string;
  leagueId: string;
}

export type Deliver = (userId: string, n: AppNotification) => void;

/**
 * Turns domain events into per-user notifications.
 *
 * Online users receive them in-app through the socket (toasts); users who are
 * not connected get an Expo push notification when they registered a token.
 */
export class NotificationService {
  constructor(
    private readonly users: UserRepository,
    private readonly deliverInApp: Deliver,
    private readonly pushEnabled: boolean,
  ) {}

  attach(host: LeagueHost): void {
    host.bus.onAny((e) => {
      try {
        this.handle(host, e);
      } catch (err) {
        console.error('[notifications]', err);
      }
    });
  }

  private handle(host: LeagueHost, e: DomainEvent): void {
    const league = host.state;
    const humans = league.members.filter((m) => !m.bot);
    const catalog = new Catalog(league.customItems);
    const ownerOf = (teamId: string | null) => league.teams.find((t) => t.id === teamId)?.ownerId ?? null;
    const teamName = (teamId: string | null) => league.teams.find((t) => t.id === teamId)?.name ?? '';
    const itemName = (id: string) => catalog.find(id)?.name ?? '';
    const send = (userIds: (string | null)[], n: Omit<AppNotification, 'leagueId'>, pushOnlyOffline = true) => {
      const full = { ...n, leagueId: league.id };
      const targets = userIds.filter((u): u is string => !!u && humans.some((m) => m.userId === u));
      for (const u of targets) this.deliverInApp(u, full);
      const offline = targets.filter((u) => !pushOnlyOffline || !league.members.find((m) => m.userId === u)?.connected);
      void this.push(offline, full);
    };

    switch (e.type) {
      case 'AuctionStarted':
        send(humans.map((m) => m.userId), { kind: 'auction_started', title: 'È iniziata l\'asta! 🔨', body: `${league.config.name}: ${e.poolSize} campioni all'asta` });
        break;
      case 'Outbid':
        send([ownerOf(e.teamId)], { kind: 'outbid', title: 'Sei stato superato! 😱', body: `${teamName(e.byTeamId)} offre ${e.amount} per ${itemName(e.itemId)}` }, false);
        break;
      case 'BidPlaced': {
        // only offline members hear about rival bids, and only on big names
        const item = catalog.find(e.itemId);
        if (!item || item.overall < 88) break;
        const offline = humans.filter((m) => !m.connected && ownerOf(e.teamId) !== m.userId).map((m) => m.userId);
        void this.push(offline, { kind: 'bid', title: 'Rilancio! 🔥', body: `Qualcuno ha rilanciato su ${item.name}! (${e.amount})`, leagueId: league.id });
        break;
      }
      case 'PlayerSold':
        if (e.result.autoAssigned || !e.result.teamId) break;
        send(humans.map((m) => m.userId), { kind: 'sold', title: 'SOLD! 🔨', body: `${itemName(e.result.itemId)} è stato acquistato da ${teamName(e.result.teamId)} per ${e.result.price}` });
        break;
      case 'MatchStarted':
        send([ownerOf(e.homeTeamId), ownerOf(e.awayTeamId)], { kind: 'match_soon', title: 'Si scende in campo! ⚽', body: `La tua partita sta per iniziare: ${teamName(e.homeTeamId)} - ${teamName(e.awayTeamId)}` });
        break;
      case 'MatchEnded':
        for (const [teamId, gf, ga] of [
          [e.homeTeamId, e.homeGoals, e.awayGoals],
          [e.awayTeamId, e.awayGoals, e.homeGoals],
        ] as const) {
          const verdict = gf > ga ? `Hai vinto ${gf}-${ga}! 🎉` : gf < ga ? `Hai perso ${gf}-${ga} 😤` : `Pareggio ${gf}-${ga} 🤝`;
          send([ownerOf(teamId)], { kind: 'match_result', title: verdict, body: `${teamName(e.homeTeamId)} ${e.homeGoals}-${e.awayGoals} ${teamName(e.awayTeamId)}` });
        }
        break;
      case 'TournamentCompleted':
        send(humans.map((m) => m.userId), { kind: 'champion', title: '🏆 Abbiamo un campione!', body: `${teamName(e.championTeamId)} vince ${league.config.name}` });
        break;
    }
  }

  /** Expo push API (https://docs.expo.dev/push-notifications/sending-notifications/). */
  private async push(userIds: string[], n: AppNotification): Promise<void> {
    if (!this.pushEnabled || !userIds.length) return;
    const tokens = this.users.pushTokens(userIds);
    if (!tokens.length) return;
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(tokens.map((to) => ({ to, title: n.title, body: n.body, sound: 'default', data: { leagueId: n.leagueId, kind: n.kind } }))),
      });
    } catch (err) {
      console.warn('[push] delivery failed', (err as Error).message);
    }
  }
}
