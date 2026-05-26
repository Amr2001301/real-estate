/**
 * Provider abstraction for AI Chat. The service depends only on this contract,
 * so the underlying engine (rule-based now; a vendor LLM could be added later)
 * is swappable without touching the controller/service. v1 ships a free,
 * deterministic RuleBasedChatProvider — NO external calls, NO keys, NO LLM.
 *
 * The contract is intentionally richer than plain text: a turn can return
 * result cards, call-to-action buttons, suggested quick replies, the fields the
 * assistant still needs from the user, and an opaque `context` blob that the
 * service persists to ChatSession.metadata so multi-turn state survives between
 * requests. All fields except `content` are optional and additive — the AI-1
 * MockProvider keeps working by returning content only.
 */

export interface ChatTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

/**
 * A catalog result rendered as a card in the chat. Discriminated by `type`.
 * Every value is sourced from the public catalog serializer — never fabricated.
 * Kept flat (no deep nesting) so the web widget and mobile clients can render it
 * directly. Arabic labels for now (i18n is deferred).
 */
export type AssistantCard =
  | {
      type: 'unit';
      id: string;
      title: string;
      subtitle?: string;
      /** Pre-formatted price string from real data (e.g. "2,500,000 ج.م"). */
      price?: string;
      area?: number;
      bedrooms?: number;
      bathrooms?: number;
      city?: string;
      imageUrl?: string | null;
      /** Public, shareable detail link. */
      href: string;
    }
  | {
      type: 'project';
      id: string;
      title: string;
      subtitle?: string;
      city?: string;
      imageUrl?: string | null;
      href: string;
    };

/**
 * A call-to-action button. `whatsapp` carries a prefilled message in `payload`
 * and the client builds the wa.me URL from its own env (phone never on server).
 * `link` is a plain navigation. `request_visit`/`request_info` trigger the
 * consent-gated capture flows (wired in FreeAI-4).
 */
export interface AssistantCta {
  kind: 'visit' | 'info' | 'whatsapp' | 'link';
  label: string;
  href?: string;
  action?: 'request_visit' | 'request_info' | 'whatsapp';
  payload?: Record<string, unknown>;
}

export interface GenerateReplyInput {
  locale: string;
  /** Prior USER/ASSISTANT turns in chronological order (context). */
  messages: ChatTurn[];
  /** The new user message. */
  userMessage: string;
  /** Opaque multi-turn state loaded from ChatSession.metadata (null on turn 1). */
  context?: Record<string, unknown> | null;
}

export interface AssistantOutput {
  content: string;
  cards?: AssistantCard[];
  ctas?: AssistantCta[];
  quickReplies?: string[];
  /** Fields the assistant still needs from the user (slot-filling). */
  missingFields?: string[];
  /** Updated multi-turn state; the service persists it to ChatSession.metadata. */
  context?: Record<string, unknown>;
  tokensIn?: number;
  tokensOut?: number;
}

/** Abstract DI token + contract. Provided via { provide: ChatProvider, useClass: ... }. */
export abstract class ChatProvider {
  abstract generateReply(input: GenerateReplyInput): Promise<AssistantOutput>;
}
