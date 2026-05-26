'use client';

import { useCallback, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FRIENDLY } from '@/lib/api';
import {
  clearStoredSessionId,
  closeChatSession,
  createChatSession,
  getAnonymousId,
  getChatSession,
  getStoredSessionId,
  sendChatFeedback,
  sendChatMessage,
  setStoredSessionId,
  type ChatUiMessage,
  type FeedbackRating,
} from '@/lib/chat';
import { ChatPanel } from './ChatPanel';

/** Routes where the widget is hidden (private area + auth screens). */
function isHiddenRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/account') ||
    pathname === '/login' ||
    pathname === '/register'
  );
}

let msgSeq = 0;
const localId = (p: string) => `${p}-${Date.now()}-${msgSeq++}`;

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const sessionIdRef = useRef<string | null>(null);
  const anonRef = useRef<string>('');
  const initialized = useRef(false);
  const lastFailed = useRef<string | null>(null);

  const anon = () => (anonRef.current ||= getAnonymousId());

  /** First-open: restore prior session or create a fresh one. */
  const initialize = useCallback(async () => {
    initialized.current = true;
    setRestoring(true);
    setError(null);
    const id = anon();

    const stored = getStoredSessionId();
    if (stored) {
      const res = await getChatSession(stored, id);
      if (res.ok && res.data.messages.length > 0) {
        sessionIdRef.current = stored;
        setMessages(
          res.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            serverId: m.role === 'ASSISTANT',
          })),
        );
        setRestoring(false);
        return;
      }
      clearStoredSessionId(); // stale/invalid → start clean
    }

    const created = await createChatSession(id);
    if (created.ok) {
      sessionIdRef.current = created.data.sessionId;
      setStoredSessionId(created.data.sessionId);
      setMessages([{ id: localId('greet'), role: 'ASSISTANT', content: created.data.greeting }]);
      setQuickReplies(created.data.quickReplies ?? []);
    } else {
      initialized.current = false; // allow retry to re-init
      setError(FRIENDLY.load);
    }
    setRestoring(false);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    if (!initialized.current) void initialize();
  };

  /** Ensure a session exists (lazily creates one if init failed earlier). */
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const created = await createChatSession(anon());
    if (!created.ok) return null;
    sessionIdRef.current = created.data.sessionId;
    setStoredSessionId(created.data.sessionId);
    return created.data.sessionId;
  }, []);

  /** Call the API for `text` and render the reply (no user bubble appended). */
  const deliver = useCallback(async (text: string) => {
    setPending(true);
    setError(null);
    setQuickReplies([]);
    const sid = await ensureSession();
    if (!sid) {
      lastFailed.current = text;
      setError(FRIENDLY.load);
      setPending(false);
      return;
    }
    const res = await sendChatMessage(sid, anon(), text);
    if (res.ok) {
      lastFailed.current = null;
      setMessages((prev) => [
        ...prev,
        {
          id: res.data.message.id,
          role: 'ASSISTANT',
          content: res.data.message.content,
          cards: res.data.cards,
          ctas: res.data.ctas,
          serverId: true,
        },
      ]);
      setQuickReplies(res.data.quickReplies ?? []);
    } else {
      lastFailed.current = text;
      setError(res.error.message);
    }
    setPending(false);
  }, [ensureSession]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || pending || restoring) return;
      setInput('');
      setMessages((prev) => [...prev, { id: localId('u'), role: 'USER', content: text }]);
      void deliver(text);
    },
    [pending, restoring, deliver],
  );

  const handleRetry = () => {
    if (lastFailed.current) {
      void deliver(lastFailed.current);
    } else if (!initialized.current) {
      void initialize();
    }
  };

  const handleFeedback = (messageId: string, rating: FeedbackRating) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    void sendChatFeedback(sid, anon(), messageId, rating); // fire-and-forget
  };

  /** Reset the local widget to an empty state; closes the old session in the DB
   *  (status only — messages are kept). Keeps the stable anonymousId. */
  const resetLocal = () => {
    const sid = sessionIdRef.current;
    if (sid) void closeChatSession(sid, anon()); // fire-and-forget; history stays
    clearStoredSessionId();
    sessionIdRef.current = null;
    lastFailed.current = null;
    initialized.current = false;
    setMessages([]);
    setQuickReplies([]);
    setError(null);
    setInput('');
  };

  /** "محادثة جديدة" — clear locally and immediately start a fresh session. */
  const handleNewChat = () => {
    resetLocal();
    void initialize();
  };

  /** "مسح المحادثة" — hide this chat on this device only (DB untouched). A new
   *  session is created lazily on the next message/open. */
  const handleClearChat = () => {
    if (!window.confirm('سيتم إخفاء هذه المحادثة من هذا الجهاز فقط. هل تريد المتابعة؟')) return;
    resetLocal();
  };

  if (isHiddenRoute(pathname)) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="افتح المساعد العقاري"
          className={cn(
            'fixed bottom-5 left-5 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full',
            'bg-gold-400 text-navy shadow-lift transition-transform duration-200 hover:scale-105',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2',
          )}
        >
          <MessageCircle className="h-6 w-6" aria-hidden />
        </button>
      )}

      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        quickReplies={quickReplies}
        pending={pending}
        restoring={restoring}
        error={error}
        input={input}
        onInputChange={setInput}
        onSend={() => send(input)}
        onRetry={handleRetry}
        onQuickReply={send}
        onFeedback={handleFeedback}
        onNewChat={handleNewChat}
        onClearChat={handleClearChat}
      />
    </>
  );
}
