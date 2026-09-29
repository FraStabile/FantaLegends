import type { LeagueConfig, Slot, Team } from '../domain/types';
import { SLOTS, slotRequirement, totalSlots } from '../domain/config';

export type SlotNeeds = Record<Slot, number>;

/** How many items of each slot the team still has to buy. */
export function slotNeeds(team: Team, cfg: LeagueConfig): SlotNeeds {
  const needs = {} as SlotNeeds;
  for (const slot of SLOTS) {
    const owned = team.roster.filter((r) => r.slot === slot).length;
    needs[slot] = Math.max(0, slotRequirement(cfg, slot) - owned);
  }
  return needs;
}

export function remainingSlots(team: Team, cfg: LeagueConfig): number {
  return Math.max(0, totalSlots(cfg) - team.roster.length);
}

export function isTeamComplete(team: Team, cfg: LeagueConfig): boolean {
  return remainingSlots(team, cfg) === 0;
}

export function canAcquireSlot(team: Team, cfg: LeagueConfig, slot: Slot): boolean {
  return slotNeeds(team, cfg)[slot] > 0;
}

export function rosterValue(team: Team): number {
  return team.roster.reduce((sum, r) => sum + r.price, 0);
}

/** Italian list of what is still missing, e.g. ["Centrocampista", "2 Attaccanti", "Allenatore"]. */
export function missingLabels(needs: SlotNeeds): string[] {
  const singular: Record<Slot, string> = { GK: 'Portiere', DF: 'Difensore', MF: 'Centrocampista', FW: 'Attaccante', COACH: 'Allenatore' };
  const plural: Record<Slot, string> = { GK: 'Portieri', DF: 'Difensori', MF: 'Centrocampisti', FW: 'Attaccanti', COACH: 'Allenatori' };
  return SLOTS.filter((s) => needs[s] > 0).map((s) => (needs[s] === 1 ? singular[s] : `${needs[s]} ${plural[s]}`));
}
