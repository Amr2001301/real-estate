import { Injectable } from '@nestjs/common';
import {
  ChatProvider,
  type AssistantOutput,
  type GenerateReplyInput,
} from './chat-provider';

/**
 * Minimal deterministic test double. NO external calls, NO tools, NO
 * hallucinated property data — it safely echoes the user's question inside a
 * clearly-labeled Arabic test reply with empty cards/ctas. The runtime default
 * is RuleBasedChatProvider; this stays as the cheap fixture for unit tests.
 */
@Injectable()
export class MockChatProvider extends ChatProvider {
  async generateReply(input: GenerateReplyInput): Promise<AssistantOutput> {
    const asked = input.userMessage.trim().replace(/\s+/g, ' ').slice(0, 280);
    const content =
      'أنا مساعد عقاري تجريبي (وضع الاختبار). سأتمكن لاحقًا من مساعدتك في البحث عن المشاريع ' +
      'والوحدات وحجز زيارة. لا أقدّم حاليًا أي بيانات فعلية عن الأسعار أو التوفر.' +
      (asked ? ` سؤالك كان: «${asked}»` : '');
    // No tokens consumed (no model call).
    return { content, cards: [], ctas: [], quickReplies: [], tokensIn: 0, tokensOut: 0 };
  }
}
