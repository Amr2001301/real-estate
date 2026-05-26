import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChatService } from '../chat.service';
import { MockChatProvider } from '../providers/mock.provider';
import { SendMessageDto, CreateSessionDto } from '../dto/chat.dto';

/** Minimal stateful Prisma mock for the three chat tables. */
function makePrismaMock() {
  const sessions = new Map<string, Record<string, unknown>>();
  const messages: Array<Record<string, unknown>> = [];
  const feedback: Array<Record<string, unknown>> = [];
  let sN = 0;
  let mN = 0;
  return {
    chatSession: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const s = {
          id: `sess-${++sN}`,
          status: 'ACTIVE',
          createdAt: new Date(),
          lastMessageAt: new Date(),
          ...data,
        };
        sessions.set(s.id as string, s);
        return s;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const s = sessions.get(where.id)!;
        Object.assign(s, data);
        return s;
      }),
    },
    chatMessage: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const m = { id: `msg-${++mN}`, createdAt: new Date(), ...data };
        messages.push(m);
        return m;
      }),
      findMany: jest.fn(async ({ where }: { where: { sessionId: string; role?: { in: string[] } } }) =>
        messages.filter(
          (m) => m.sessionId === where.sessionId && (!where.role?.in || where.role.in.includes(m.role as string)),
        ),
      ),
    },
    chatFeedback: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const f = { id: `fb-${feedback.length + 1}`, createdAt: new Date(), ...data };
        feedback.push(f);
        return f;
      }),
    },
    _state: { sessions, messages, feedback },
  };
}

describe('ChatService (AI-1, MockProvider)', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let provider: MockChatProvider;
  let svc: ChatService;
  // Spy to prove no external provider call path beyond the local mock.
  let providerSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = makePrismaMock();
    provider = new MockChatProvider();
    providerSpy = jest.spyOn(provider, 'generateReply');
    svc = new ChatService(prisma as never, provider);
  });

  it('createSession returns sessionId + Arabic greeting + quickReplies and persists', async () => {
    const res = await svc.createSession({ anonymousId: 'anon-1', source: undefined, locale: undefined });
    expect(res.sessionId).toBe('sess-1');
    expect(res.greeting).toContain('المساعد العقاري');
    expect(res.quickReplies.length).toBeGreaterThan(0);
    expect(prisma._state.sessions.get('sess-1')).toMatchObject({ anonymousId: 'anon-1', source: 'WEB', locale: 'ar' });
  });

  it('sendMessage stores USER then ASSISTANT, updates lastMessageAt, returns assistant reply', async () => {
    const { sessionId } = await svc.createSession({ anonymousId: 'anon-1' });
    const res = await svc.sendMessage(sessionId, { anonymousId: 'anon-1', content: 'أبحث عن شقة في الرياض' });

    expect(providerSpy).toHaveBeenCalledTimes(1); // only the local mock, no external call
    expect(res.message.role).toBe('ASSISTANT');
    expect(res.message.content).toContain('مساعد عقاري تجريبي');
    expect(res.message.content).toContain('أبحث عن شقة في الرياض'); // safe echo
    expect(res.cards).toEqual([]);
    expect(res.ctas).toEqual([]);

    const roles = prisma._state.messages.map((m) => m.role);
    expect(roles).toEqual(['USER', 'ASSISTANT']);
    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: sessionId }, data: expect.objectContaining({ lastMessageAt: expect.any(Date) }) }),
    );
  });

  it('getSession returns messages for the matching anonymousId', async () => {
    const { sessionId } = await svc.createSession({ anonymousId: 'anon-1' });
    await svc.sendMessage(sessionId, { anonymousId: 'anon-1', content: 'مرحبا' });
    const res = await svc.getSession(sessionId, 'anon-1');
    expect(res.session.id).toBe(sessionId);
    expect(res.messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
  });

  it('getSession with a wrong anonymousId throws 404 (no existence leak)', async () => {
    const { sessionId } = await svc.createSession({ anonymousId: 'anon-1' });
    await expect(svc.getSession(sessionId, 'attacker')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sendMessage with a wrong anonymousId throws 404', async () => {
    const { sessionId } = await svc.createSession({ anonymousId: 'anon-1' });
    await expect(svc.sendMessage(sessionId, { anonymousId: 'attacker', content: 'hi' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('addFeedback persists for the owner', async () => {
    const { sessionId } = await svc.createSession({ anonymousId: 'anon-1' });
    const res = await svc.addFeedback(sessionId, { anonymousId: 'anon-1', rating: 'UP' as never });
    expect(res).toEqual({ ok: true });
    expect(prisma._state.feedback).toHaveLength(1);
  });

  it('closeSession sets status CLOSED for the owner and keeps messages', async () => {
    const { sessionId } = await svc.createSession({ anonymousId: 'anon-1' });
    await svc.sendMessage(sessionId, { anonymousId: 'anon-1', content: 'مرحبا' });
    const res = await svc.closeSession(sessionId, 'anon-1');
    expect(res).toEqual({ ok: true });
    expect(prisma._state.sessions.get(sessionId)).toMatchObject({ status: 'CLOSED' });
    // messages are NOT deleted (history stays in the DB)
    expect(prisma._state.messages.filter((m) => m.sessionId === sessionId)).toHaveLength(2);
  });

  it('closeSession with a wrong anonymousId throws 404 (no deletion)', async () => {
    const { sessionId } = await svc.createSession({ anonymousId: 'anon-1' });
    await expect(svc.closeSession(sessionId, 'attacker')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Chat DTO validation', () => {
  it('rejects empty content', async () => {
    const dto = plainToInstance(SendMessageDto, { anonymousId: 'a', content: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('rejects content over the 2000-char cap', async () => {
    const dto = plainToInstance(SendMessageDto, { anonymousId: 'a', content: 'x'.repeat(2001) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('rejects missing anonymousId on session create', async () => {
    const dto = plainToInstance(CreateSessionDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'anonymousId')).toBe(true);
  });

  it('accepts a valid message payload', async () => {
    const dto = plainToInstance(SendMessageDto, { anonymousId: 'a', content: 'مرحبا' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
