'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PremiumPageHero } from '@/components/premium';
import { getClientLocale } from '@/lib/locale-client';
import { aiT } from '@/components/ai/ai-strings';
import { AnswerText } from '@/components/ai/answer-text';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface Status {
  available: boolean;
  reason: 'NOT_CONFIGURED' | 'NOT_ACTIVE' | 'EXHAUSTED' | null;
}

const STORE_KEY = 'ai-assistant-chat';
/** Earlier turns sent with each question (the API keeps no chat). */
const HISTORY_TURNS = 20;

function loadChat(): Turn[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Turn[]) : [];
  } catch {
    return [];
  }
}

function saveChat(turns: Turn[]) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(turns));
  } catch {
    // Storage blocked — the chat simply isn't kept across pages.
  }
}

// The AI assistant: company staff ask about their own data, read-only.
export default function AssistantPage() {
  const locale = getClientLocale();
  const m = useMemo(() => aiT(locale), [locale]);
  const c = m.chat;
  const [status, setStatus] = useState<Status | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns(loadChat());
    void fetch('/api-proxy/ai/status')
      .then(async (r) => (r.ok ? ((await r.json()) as Status) : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    saveChat(turns);
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, pending]);

  async function ask(question: string) {
    const message = question.trim();
    if (!message || pending) return;
    setError(null);
    const history = turns.slice(-HISTORY_TURNS);
    setTurns((t) => [...t, { role: 'user', content: message }]);
    setInput('');
    setPending(true);
    try {
      const res = await fetch('/api-proxy/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
        const code = res.status === 429 ? 'RATE' : body.code;
        setError((code && c.errors[code]) || body.message || m.error);
        // The question was not answered: take it back off the chat, keep it in the box.
        setTurns((t) => t.slice(0, -1));
        setInput(message);
        if (code === 'AI_QUOTA_EXHAUSTED') setStatus({ available: false, reason: 'EXHAUSTED' });
        if (code === 'AI_NOT_ACTIVE') setStatus({ available: false, reason: 'NOT_ACTIVE' });
        return;
      }
      const data = (await res.json()) as { answer: string; usage: { remaining: number } };
      setTurns((t) => [...t, { role: 'assistant', content: data.answer }]);
      if (data.usage.remaining <= 0) setStatus({ available: false, reason: 'EXHAUSTED' });
    } catch {
      setError(m.error);
      setTurns((t) => t.slice(0, -1));
      setInput(message);
    } finally {
      setPending(false);
    }
  }

  const blocked = status && !status.available && status.reason ? c.unavailable[status.reason] : null;
  const canAsk = !pending && status?.available !== false;

  return (
    <div className="flex flex-col gap-5">
      <PremiumPageHero
        title={m.title}
        description={c.description}
        actions={
          turns.length > 0 ? (
            <Button variant="secondary" onClick={() => setTurns([])} disabled={pending}>
              <RotateCcw className="h-4 w-4" />
              {c.clear}
            </Button>
          ) : undefined
        }
      />

      {blocked && (
        <div role="status" data-testid="ai-unavailable" className="rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {blocked}
        </div>
      )}

      <section className="flex min-h-[420px] flex-col rounded-[20px] border border-hairline bg-surface shadow-soft">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5" aria-live="polite" data-testid="ai-chat">
          {turns.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-hairline text-brand-700">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="max-w-md text-sm text-slate-500">{c.scopeHint}</p>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {c.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!canAsk}
                    onClick={() => void ask(s)}
                    className="rounded-full border border-hairline px-3 py-1.5 text-sm text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, k) => (
            <div key={k} className={`flex ${t.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                dir="auto"
                aria-label={t.role === 'user' ? c.you : c.assistant}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  t.role === 'user' ? 'bg-brand-600 text-white' : 'border border-hairline bg-surface-sunken text-slate-800'
                }`}
              >
                {t.role === 'user' ? <p className="whitespace-pre-wrap">{t.content}</p> : <AnswerText text={t.content} />}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-hairline bg-surface-sunken px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {c.thinking}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex flex-col gap-2 border-t border-hairline p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          {error && (
            <p role="alert" data-testid="ai-chat-error" className="text-sm text-danger-700">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              dir="auto"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={c.placeholder}
              aria-label={c.placeholder}
              disabled={!canAsk && !pending}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 disabled:opacity-60"
            />
            <Button type="submit" disabled={!canAsk || !input.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
              {c.send}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
