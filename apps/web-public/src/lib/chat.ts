/**
 * Client-side helpers for the free, rule-based chat assistant.
 *
 * All requests go through the public `safeFetch`/`safePost` funnel, which on the
 * browser hits `/api-proxy/chat/*` (Next rewrite → API `/v1/chat/*`). Chat is
 * public and anonymous: the middleware adds NO Authorization header when there's
 * no `access_token` cookie, so these calls work for guests. No tokens, no keys.
 */

import { safeFetch, safePost, type ApiResult } from '@/lib/api';

// ---- Response shapes (mirror the backend AssistantOutput / DTOs) ----

export interface ChatUnitCard {
  type: 'unit';
  id: string;
  title: string;
  subtitle?: string;
  price?: string;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  imageUrl?: string | null;
  href: string;
}

export interface ChatProjectCard {
  type: 'project';
  id: string;
  title: string;
  subtitle?: string;
  city?: string;
  imageUrl?: string | null;
  href: string;
}

export type ChatCard = ChatUnitCard | ChatProjectCard;

export interface ChatCta {
  kind: 'link' | 'whatsapp' | 'visit' | 'info';
  label: string;
  href?: string;
  action?: string;
  payload?: { message?: string } & Record<string, unknown>;
}

export type ChatRole = 'USER' | 'ASSISTANT';

/** A rendered message in the UI (server messages + locally-appended ones). */
export interface ChatUiMessage {
  /** Local key; for assistant server messages this is the real id (for feedback). */
  id: string;
  role: ChatRole;
  content: string;
  cards?: ChatCard[];
  ctas?: ChatCta[];
  /** Whether `id` is a real server message id (feedback-eligible). */
  serverId?: boolean;
}

interface CreateSessionResponse {
  sessionId: string;
  greeting: string;
  quickReplies: string[];
}

interface SendMessageResponse {
  message: { id: string; role: ChatRole; content: string };
  cards?: ChatCard[];
  ctas?: ChatCta[];
  quickReplies?: string[];
  missingFields?: string[];
}

interface GetSessionResponse {
  session: { id: string; status: string };
  messages: Array<{ id: string; role: ChatRole; content: string; createdAt: string }>;
}

export type FeedbackRating = 'UP' | 'DOWN';

export const CHAT_MAX_LENGTH = 2000;

// ---- API calls ----

export function createChatSession(anonymousId: string): Promise<ApiResult<CreateSessionResponse>> {
  return safePost<CreateSessionResponse>('/chat/sessions', { anonymousId, source: 'WEB' });
}

export function sendChatMessage(
  sessionId: string,
  anonymousId: string,
  content: string,
): Promise<ApiResult<SendMessageResponse>> {
  return safePost<SendMessageResponse>(`/chat/sessions/${sessionId}/messages`, { anonymousId, content });
}

export function getChatSession(
  sessionId: string,
  anonymousId: string,
): Promise<ApiResult<GetSessionResponse>> {
  return safeFetch<GetSessionResponse>(
    `/chat/sessions/${sessionId}?anonymousId=${encodeURIComponent(anonymousId)}`,
  );
}

/** Mark the current session CLOSED server-side (history is kept in the DB). */
export function closeChatSession(
  sessionId: string,
  anonymousId: string,
): Promise<ApiResult<{ ok: boolean }>> {
  return safeFetch<{ ok: boolean }>(`/chat/sessions/${sessionId}/close`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonymousId }),
  });
}

export function sendChatFeedback(
  sessionId: string,
  anonymousId: string,
  messageId: string,
  rating: FeedbackRating,
): Promise<ApiResult<{ ok: boolean }>> {
  return safePost<{ ok: boolean }>(`/chat/sessions/${sessionId}/feedback`, {
    anonymousId,
    messageId,
    rating,
  });
}

// ---- Anonymous identity + session persistence (localStorage) ----

const ANON_KEY = 're_chat_anon';
const SESSION_KEY = 're_chat_session';

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-browser visitor id, created once and reused. */
export function getAnonymousId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(ANON_KEY);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function setStoredSessionId(sessionId: string): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(SESSION_KEY, sessionId);
}

export function clearStoredSessionId(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_KEY);
}
