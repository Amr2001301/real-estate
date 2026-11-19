import { BrokerPortalActivityService } from '../broker-portal-activity.service';

/** The portal activity feed's search: a word in the lead's name or phone; payout events have no lead. */
function make() {
  const svc = Object.create(BrokerPortalActivityService.prototype) as BrokerPortalActivityService;
  const where = (query: object) =>
    (svc as unknown as { leadWhere(s: unknown, q: unknown, v: unknown): { lead: Record<string, unknown> } }).leadWhere(
      { brokerId: 'b1' },
      query,
      { canSeeAllAgents: true, canViewCommissions: true },
    );
  return { where };
}

describe('portal activity · search', () => {
  it('matches the lead by name or phone', () => {
    const w = JSON.stringify(make().where({ q: 'سارة' }).lead);
    expect(w).toContain('سارة');
    expect(w).toContain('fullName');
    expect(w).toContain('phone');
  });

  it('no q, no OR', () => {
    expect(make().where({}).lead.OR).toBeUndefined();
  });
});
