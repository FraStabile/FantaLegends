import { describe, expect, it } from 'vitest';
import { TournamentEngine, evaluateTalk, matchImportance, simulateMatch, type TalkContext } from '../src/index';
import { MASTER, lobby } from './helpers';
import { STRONG, input } from './fixtures';

/** Knockout league: every round is important, so a talk is always on offer. */
function knockoutSeason() {
  const { host, scheduler } = lobby({ humans: 1, bots: ['shark', 'saver', 'tactician'], botsEnabled: true, config: { format: 'knockout' } });
  host.startAuction(MASTER);
  scheduler.runAll();
  host.startSeason(MASTER);
  const myTeam = host.teamOf(MASTER)!;
  const myMatch = TournamentEngine.pendingRound(host.state.tournament!).find((m) => m.homeTeamId === myTeam || m.awayTeamId === myTeam)!;
  return { host, scheduler, myTeam, myMatch };
}

describe('Team talk', () => {
  it('is offered before important matches, with hints about the situation', () => {
    const { host, myMatch } = knockoutSeason();
    expect(matchImportance(host.state as never, myMatch)).toBe('Semifinale');
    const offer = host.view(MASTER).teamTalk!;
    expect(offer.matchId).toBe(myMatch.id);
    expect(offer.hints.length).toBeGreaterThanOrEqual(2);
    expect(offer.given).toBeNull();
  });

  it('can be given once, and the reaction is stored with its effect', () => {
    const { host, myMatch } = knockoutSeason();
    const talk = host.giveTeamTalk(MASTER, myMatch.id, 'prove_them_wrong', 'passionate');
    expect(['fired_up', 'focused', 'neutral', 'complacent', 'nervous']).toContain(talk.reaction);
    expect(host.view(MASTER).teamTalk!.given).toMatchObject({ phrase: 'prove_them_wrong', tone: 'passionate', reaction: talk.reaction });
    expect(() => host.giveTeamTalk(MASTER, myMatch.id, 'enjoy_it', 'calm')).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
  });

  it("keeps each team's talk secret from the opponent until kickoff", () => {
    const { host, myMatch, myTeam } = knockoutSeason();
    const oppId = myMatch.homeTeamId === myTeam ? myMatch.awayTeamId : myMatch.homeTeamId;
    const opp = host.state.members.find((m) => m.teamId === oppId)!;
    host.giveTeamTalk(MASTER, myMatch.id, 'for_the_fans', 'passionate');
    const seenByOpp = host.view(opp.userId).tournament!.matches.find((m) => m.id === myMatch.id)!;
    expect(seenByOpp.talks ?? []).toHaveLength(0);
    expect(host.matchView(myMatch.id).summary.talks).toBeUndefined();
  });

  it('bots talk to their team on their own when the round starts', () => {
    const { host, myMatch } = knockoutSeason();
    host.playRound(MASTER, 'instant');
    const played = host.state.tournament!.matches.filter((m) => m.round === myMatch.round);
    const botTalks = played.flatMap((m) => m.talks ?? []).filter((t) => host.state.members.find((x) => x.teamId === t.teamId)?.bot);
    expect(botTalks.length).toBe(3);
  });

  it('good words for the situation land better than bad ones', () => {
    const underdogAfterLoss: TalkContext = { favourite: -0.7, form: -0.3, lastResult: 'L', stakes: 0.8, motivation: 8 };
    const score = (r: string) => ({ fired_up: 2, focused: 1, neutral: 0, complacent: -1, nervous: -2 })[r]!;
    let good = 0, bad = 0;
    for (let i = 0; i < 200; i++) {
      good += score(evaluateTalk('prove_them_wrong', 'passionate', underdogAfterLoss, `k${i}`).reaction);
      bad += score(evaluateTalk('we_are_better', 'confident', underdogAfterLoss, `k${i}`).reaction);
    }
    expect(good).toBeGreaterThan(bad + 100);
  });

  it('a fired-up team plays better than a nervous one', () => {
    let fired = 0, nervous = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const a = input(seed, STRONG, STRONG);
      a.home.talk = { morale: 0.1, discipline: 1.1, focus: 0.9 };
      const b = input(seed, STRONG, STRONG);
      b.home.talk = { morale: -0.08, discipline: 1.3, focus: 1.3 };
      const ra = simulateMatch(a), rb = simulateMatch(b);
      fired += ra.homeGoals - ra.awayGoals;
      nervous += rb.homeGoals - rb.awayGoals;
    }
    expect(fired).toBeGreaterThan(nervous);
  });
});
