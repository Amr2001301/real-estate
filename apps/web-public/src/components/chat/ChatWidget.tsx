'use client';

import { useCallback, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
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
        <div className="fixed bottom-6 left-6 z-[60] flex flex-col items-center gap-3">
          {/* WhatsApp — secondary action, sits above the AI button */}
          <a
            href="https://wa.me/201008239075"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="تواصل عبر واتساب"
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-emerald-600 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[22px] w-[22px]" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-navy-700 bg-navy px-2.5 py-1 text-[11px] font-bold text-white opacity-0 shadow-xl transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              تواصل عبر واتساب
            </span>
          </a>

          {/* AI assistant — hero action */}
          <button
            type="button"
            onClick={handleOpen}
            aria-label="مساعد ديفورا الذكي"
            className={cn(
              'group relative flex h-14 w-14 items-center justify-center rounded-full',
              'bg-gradient-to-tr from-navy via-indigo-950 to-navy text-gold-400 ring-1 ring-navy-700',
              'shadow-[0_8px_30px_rgb(0,0,0,0.18)] transition-all duration-300 hover:scale-110 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2',
            )}
          >
            {/* Pulsing AI "brain" ring */}
            <span
              className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-indigo-500/20 group-hover:bg-indigo-500/30"
              aria-hidden
            />
            <Sparkles className="relative h-6 w-6 animate-pulse" aria-hidden />
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-navy-700 bg-navy px-2.5 py-1 text-[11px] font-bold text-white opacity-0 shadow-xl transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              مساعد ديفورا الذكي AI
            </span>
          </button>
        </div>
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
