import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, isTeamComplete, missingLabels, remainingSlots, resolveConfig, rosterValue, slotNeeds, totalSlots, type Team } from '../src/index';
import { MASTER, lobby } from './helpers';

const team = (roster: Team['roster'] = []): Team => ({ id: 't', name: 'T', ownerId: 'u', logo: { emoji: '⚽', color: '#fff' }, credits: 87, roster });
const entry = (slot: Team['roster'][number]['slot'], price = 10) => ({ itemId: `${slot}-${Math.random()}`, kind: slot === 'COACH' ? ('coach' as const) : ('player' as const), slot, price, lotNumber: 1, autoAssigned: false });

describe('TeamValidation', () => {
  it('default roster is 1 GK, 1 DF, 1 MF, 2 FW + coach', () => {
    expect(totalSlots(DEFAULT_CONFIG)).toBe(6);
    expect(slotNeeds(team(), DEFAULT_CONFIG)).toEqual({ GK: 1, DF: 1, MF: 1, FW: 2, COACH: 1 });
  });

  it('tracks what is missing, e.g. "Centrocampista, 2 Attaccanti, Allenatore"', () => {
    const t = team([entry('GK', 12), entry('DF', 15)]);
    expect(missingLabels(slotNeeds(t, DEFAULT_CONFIG))).toEqual(['Centrocampista', '2 Attaccanti', 'Allenatore']);
    expect(remainingSlots(t, DEFAULT_CONFIG)).toBe(4);
    expect(rosterValue(t)).toBe(27);
    expect(isTeamComplete(t, DEFAULT_CONFIG)).toBe(false);
  });

  it('supports a configurable roster without coach', () => {
    const cfg = resolveConfig({ roster: { GK: 1, DF: 2, MF: 2, FW: 2, coach: false } });
    expect(totalSlots(cfg)).toBe(7);
    expect(slotNeeds(team(), cfg).COACH).toBe(0);
  });

  it('rejects invalid configurations', () => {
    expect(() => resolveConfig({ startingCredits: 20, roster: { GK: 1, DF: 6, MF: 6, FW: 6 }, minPrice: 2 })).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }));
    expect(() => resolveConfig({ roster: { GK: 0 } })).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }));
    expect(() => resolveConfig({ maxParticipants: 1 })).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }));
  });

  it('lobby rules: start requires the master, 2+ members and everyone ready', () => {
    const { host } = lobby({ humans: 1 });
    expect(() => host.startAuction(MASTER)).toThrow('NOT_ENOUGH_PARTICIPANTS');
    host.join({ userId: 'u-x', displayName: 'X', avatar: '⚽' });
    expect(() => host.startAuction(MASTER)).toThrow('NOT_ALL_READY');
    expect(() => host.startAuction('u-x')).toThrow('FORBIDDEN');
    host.setReady('u-x', true);
    host.updateConfig(MASTER, { startingCredits: 200 });
    // rules changed: members must confirm again
    expect(host.state.members.find((m) => m.userId === 'u-x')?.ready).toBe(false);
    expect(host.state.teams.every((t) => t.credits === 200)).toBe(true);
    host.setReady('u-x', true);
    host.startAuction(MASTER);
    expect(host.state.status).toBe('auction');
  });

  it('league capacity is enforced and the master role is inherited', () => {
    const { host } = lobby({ humans: 2, config: { maxParticipants: 3 } });
    host.join({ userId: 'u-3', displayName: 'Tre', avatar: '⚽' });
    expect(() => host.join({ userId: 'u-4', displayName: 'Quattro', avatar: '⚽' })).toThrow('LEAGUE_FULL');
    expect(() => host.join({ userId: 'u-3', displayName: 'Tre', avatar: '⚽' })).toThrow('ALREADY_MEMBER');
    host.leave(MASTER);
    expect(host.state.members.find((m) => m.userId === 'u-marco')?.isMaster).toBe(true);
  });
});
