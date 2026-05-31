import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatRole, ChatSource, ChatStatus, Locale, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatProvider, type ChatTurn } from './providers/chat-provider';
import { CreateSessionDto, FeedbackDto, SendMessageDto } from './dto/chat.dto';

const GREETING =
  'مرحبًا! أنا المساعد العقاري لديفورا. كيف يمكنني مساعدتك اليوم؟';
const QUICK_REPLIES = ['أبحث عن شقة', 'أبحث عن مشروع', 'كيف أحجز زيارة؟', 'تواصل مع مستشار'];
const HISTORY_LIMIT = 40;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ChatProvider,
  ) {}

  async createSession(dto: CreateSessionDto) {
    const session = await this.prisma.chatSession.create({
      data: {
        source: dto.source ?? ChatSource.WEB,
        locale: dto.locale ?? Locale.ar,
        anonymousId: dto.anonymousId,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return { sessionId: session.id, greeting: GREETING, quickReplies: QUICK_REPLIES };
  }

  /**
   * Fetch a session only when the caller's anonymousId matches. A mismatch (or
   * missing session) throws 404 so we never leak whether a session id exists.
   */
  private async requireOwnedSession(id: string, anonymousId: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id } });
    if (!session || session.anonymousId !== anonymousId) {
      throw new NotFoundException('Chat session not found');
    }
    return session;
  }

  async sendMessage(id: string, dto: SendMessageDto) {
    const session = await this.requireOwnedSession(id, dto.anonymousId);

    await this.prisma.chatMessage.create({
      data: { sessionId: id, role: ChatRole.USER, content: dto.content },
    });

    // Prior conversational turns (USER/ASSISTANT only) for context.
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: id, role: { in: [ChatRole.USER, ChatRole.ASSISTANT] } },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });
    const turns: ChatTurn[] = history.map((m) => ({
      role: m.role === ChatRole.ASSISTANT ? 'ASSISTANT' : 'USER',
      content: m.content,
    }));

    const reply = await this.provider.generateReply({
      locale: session.locale,
      messages: turns,
      userMessage: dto.content,
      context: (session.metadata ?? null) as Record<string, unknown> | null,
    });

    const assistant = await this.prisma.chatMessage.create({
      data: {
        sessionId: id,
        role: ChatRole.ASSISTANT,
        content: reply.content,
        tokensIn: reply.tokensIn ?? null,
        tokensOut: reply.tokensOut ?? null,
      },
    });

    // Persist the assistant's updated multi-turn state alongside the timestamp,
    // so the next turn resumes the same slot-filling flow.
    await this.prisma.chatSession.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        ...(reply.context !== undefined
          ? { metadata: reply.context as Prisma.InputJsonValue }
          : {}),
      },
    });

    return {
      message: { id: assistant.id, role: 'ASSISTANT' as const, content: assistant.content },
      cards: reply.cards ?? [],
      ctas: reply.ctas ?? [],
      quickReplies: reply.quickReplies ?? [],
      missingFields: reply.missingFields ?? [],
    };
  }

  async getSession(id: string, anonymousId: string) {
    const session = await this.requireOwnedSession(id, anonymousId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return {
      session: {
        id: session.id,
        source: session.source,
        locale: session.locale,
        status: session.status,
        createdAt: session.createdAt,
      },
      messages,
    };
  }

  /**
   * Mark a session CLOSED (e.g. user started a new chat). Ownership-checked.
   * Messages are kept — this only flips status; history stays in the DB.
   */
  async closeSession(id: string, anonymousId: string) {
    await this.requireOwnedSession(id, anonymousId);
    await this.prisma.chatSession.update({
      where: { id },
      data: { status: ChatStatus.CLOSED },
    });
    return { ok: true };
  }

  async addFeedback(id: string, dto: FeedbackDto) {
    await this.requireOwnedSession(id, dto.anonymousId);
    await this.prisma.chatFeedback.create({
      data: {
        sessionId: id,
        messageId: dto.messageId ?? null,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });
    return { ok: true };
  }
}
