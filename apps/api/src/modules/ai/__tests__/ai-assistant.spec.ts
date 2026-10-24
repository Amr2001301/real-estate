import { HttpException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { runInCompany } from '../../../common/tenant/tenant-context';
import { AiAssistantService, conversation } from '../ai-assistant.service';
import { AssistantTools } from '../ai-assistant.tools';

const COMPANY = '00000000-0000-0000-0000-0000000000c1';
const ME = '00000000-0000-0000-0000-0000000000a1';
const user = (role: UserRole) => ({ sub: ME, role, email: null, phone: null, companyId: COMPANY });

function setup(enabled = true) {
  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue({ name: 'Acme', currency: 'EGP' }) },
    user: { findFirst: jest.fn().mockResolvedValue({ fullName: 'Mona' }) },
  };
  const plans = {
    consume: jest.fn().mockResolvedValue({ used: 1, quota: 10, remaining: 9 }),
    refund: jest.fn().mockResolvedValue(undefined),
  };
  const model = { enabled, turn: jest.fn() };
  const service = new AiAssistantService(prisma as never, plans as never, model as never);
  return { service, plans, model };
}

const ask = (service: AiAssistantService, role: UserRole = UserRole.SALES, message = 'كم قسط متأخر؟') =>
  runInCompany(COMPANY, () => service.ask({ message }, user(role)));

const errorCode = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return { status: (e as HttpException).getStatus(), code: ((e as HttpException).getResponse() as { code?: string }).code };
  }
  throw new Error('expected a rejection');
};

describe('AiAssistantService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refuses with 503 and counts nothing when no model is configured', async () => {
    const { service, plans } = setup(false);
    expect(await errorCode(ask(service))).toEqual({ status: 503, code: 'AI_NOT_CONFIGURED' });
    expect(plans.consume).not.toHaveBeenCalled();
  });

  it('refuses roles outside the company staff', async () => {
    const { service, plans } = setup();
    expect((await errorCode(ask(service, UserRole.CLIENT))).status).toBe(403);
    expect(plans.consume).not.toHaveBeenCalled();
  });

  it('runs the tools the model asks for and returns its answer, counted once', async () => {
    const { service, plans, model } = setup();
    const run = jest.spyOn(AssistantTools.prototype, 'run').mockResolvedValue([{ customer: 'Ali', amount: 5000 }]);
    model.turn
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Checking.' },
          { type: 'tool_use', id: 't1', name: 'list_overdue_installments', input: { limit: 5 } },
          { type: 'tool_use', id: 't2', name: 'company_overview', input: {} },
        ],
      })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'قسط واحد متأخر لعلي.' }] });

    const res = await ask(service);
    expect(res).toEqual({ answer: 'قسط واحد متأخر لعلي.', usage: { used: 1, quota: 10, remaining: 9 } });
    expect(plans.consume).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('list_overdue_installments', { limit: 5 });
    // Both results go back in one user turn, after the assistant's own turn.
    const second = model.turn.mock.calls[1][0].messages;
    expect(second).toHaveLength(3);
    expect(second[1].role).toBe('assistant');
    expect(second[2].role).toBe('user');
    expect(second[2].content.map((b: { tool_use_id: string }) => b.tool_use_id)).toEqual(['t1', 't2']);
  });

  it('reports a failed lookup to the model as an error instead of failing the question', async () => {
    const { service, model } = setup();
    jest.spyOn(AssistantTools.prototype, 'run').mockRejectedValue(new Error('db down'));
    model.turn
      .mockResolvedValueOnce({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_units', input: {} }] })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'تعذّر البحث.' }] });
    expect((await ask(service)).answer).toBe('تعذّر البحث.');
    expect(model.turn.mock.calls[1][0].messages[2].content[0]).toMatchObject({ is_error: true });
  });

  it('gives the question back when the model cannot be reached', async () => {
    const { service, plans, model } = setup();
    model.turn.mockRejectedValue(new Error('overloaded'));
    expect(await errorCode(ask(service))).toEqual({ status: 503, code: 'AI_UNAVAILABLE' });
    expect(plans.refund).toHaveBeenCalledWith(COMPANY);
  });

  it('stops after a bounded number of tool turns', async () => {
    const { service, model } = setup();
    jest.spyOn(AssistantTools.prototype, 'run').mockResolvedValue({});
    model.turn.mockResolvedValue({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: 'company_overview', input: {} }] });
    expect((await ask(service)).answer).toMatch(/simpler question/);
    expect(model.turn).toHaveBeenCalledTimes(6);
  });

  it('a quota refusal passes through and nothing is asked of the model', async () => {
    const { service, plans, model } = setup();
    plans.consume.mockRejectedValue(new (jest.requireActual('@nestjs/common').ForbiddenException)({ code: 'AI_QUOTA_EXHAUSTED' }));
    expect(await errorCode(ask(service))).toEqual({ status: 403, code: 'AI_QUOTA_EXHAUSTED' });
    expect(model.turn).not.toHaveBeenCalled();
    expect(plans.refund).not.toHaveBeenCalled();
  });
});

describe('conversation()', () => {
  it('starts with the user, alternates, and ends on the assistant before the new question', () => {
    expect(
      conversation([
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b' },
        { role: 'assistant', content: 'c' },
        { role: 'user', content: 'dangling' },
      ]),
    ).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
    ]);
  });
});

describe('AssistantTools scoping', () => {
  const TEAM = '00000000-0000-0000-0000-0000000000a2';
  function tools(role: UserRole) {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: TEAM }]) },
      lead: { findMany: jest.fn().mockResolvedValue([]) },
      reservation: { findMany: jest.fn().mockResolvedValue([]) },
      installment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const tools = new AssistantTools(prisma as never, { userId: ME, role, companyId: COMPANY });
    const t = { run: (name: string, input: Record<string, unknown>) => runInCompany(COMPANY, () => tools.run(name, input)) };
    return { prisma, t };
  }

  it('a sales rep sees only their own leads, never the unassigned queue', async () => {
    const { prisma, t } = tools(UserRole.SALES);
    await t.run('list_leads', { unassigned: true });
    expect(prisma.lead.findMany.mock.calls[0][0].where).toEqual({ companyId: COMPANY, assignedSalesId: { in: [ME] } });
  });

  it("a sales manager sees their team's work and the unassigned queue", async () => {
    const { prisma, t } = tools(UserRole.SALES_MANAGER);
    await t.run('list_reservations', {});
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ companyId: COMPANY, managerId: ME });
    expect(prisma.reservation.findMany.mock.calls[0][0].where).toMatchObject({ companyId: COMPANY, salesId: { in: [ME, TEAM] } });
    await t.run('list_leads', { unassigned: true });
    expect(prisma.lead.findMany.mock.calls[0][0].where).toEqual({ companyId: COMPANY, assignedSalesId: null });
  });

  it('an admin sees the whole company, still within it', async () => {
    const { prisma, t } = tools(UserRole.ADMIN);
    await t.run('list_overdue_installments', {});
    const where = prisma.installment.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe(COMPANY);
    expect(where.plan.contract.reservation).toBeUndefined();
  });

  it("a sales rep's overdue installments are their own clients'", async () => {
    const { prisma, t } = tools(UserRole.SALES);
    await t.run('list_overdue_installments', {});
    const where = prisma.installment.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe(COMPANY);
    expect(where.plan.contract).toMatchObject({ status: 'ACTIVE', deletedAt: null, reservation: { salesId: { in: [ME] } } });
  });
});
