/**
 * BRK-3 — how a deal's commission is shared and how a developer claim reads.
 */
import { ClaimStatus, DealSplitRole } from '@prisma/client';
import { claimStatus, planSplits } from '../deal-math';

describe('planSplits', () => {
  const rule = { agentPct: 30, managerPct: 5 };

  it('gives the agent and their manager their shares of the commission', () => {
    expect(planSplits(100_000, rule, 'agent', 'boss')).toEqual([
      { userId: 'agent', role: DealSplitRole.AGENT, sharePct: 30, amount: 30_000 },
      { userId: 'boss', role: DealSplitRole.MANAGER, sharePct: 5, amount: 5_000 },
    ]);
  });

  it('rounds to the piaster', () => {
    expect(planSplits(1_000.01, { agentPct: 33.33, managerPct: 0 }, 'a', null)[0]!.amount).toBe(
      333.3,
    );
  });

  it('shares nothing without a rule or an agent, and never pays the agent twice', () => {
    expect(planSplits(100_000, null, 'agent', 'boss')).toEqual([]);
    expect(planSplits(100_000, rule, null, 'boss')).toEqual([]);
    expect(planSplits(100_000, rule, 'agent', 'agent').map((s) => s.role)).toEqual([
      DealSplitRole.AGENT,
    ]);
    expect(
      planSplits(100_000, { agentPct: 0, managerPct: 5 }, 'agent', 'boss').map((s) => s.role),
    ).toEqual([DealSplitRole.MANAGER]);
  });
});

describe('claimStatus', () => {
  const base = { amount: 50_000, paid: 0, submittedOn: null as Date | null, rejected: false };
  it('is pending, then submitted, then partly paid, then paid', () => {
    expect(claimStatus(base)).toBe(ClaimStatus.PENDING);
    expect(claimStatus({ ...base, submittedOn: new Date() })).toBe(ClaimStatus.SUBMITTED);
    expect(claimStatus({ ...base, paid: 10_000 })).toBe(ClaimStatus.PARTIALLY_PAID);
    expect(claimStatus({ ...base, paid: 50_000 })).toBe(ClaimStatus.PAID);
  });
  it('a rejected claim stays rejected until money comes in', () => {
    expect(claimStatus({ ...base, submittedOn: new Date(), rejected: true })).toBe(
      ClaimStatus.REJECTED,
    );
    expect(claimStatus({ ...base, paid: 1, rejected: true })).toBe(ClaimStatus.PARTIALLY_PAID);
  });
});
