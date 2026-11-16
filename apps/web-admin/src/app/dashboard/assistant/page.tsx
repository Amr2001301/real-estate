'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  Building2,
  CalendarClock,
  Check,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PremiumPanel } from '@/components/premium';
import { useClientLocale } from '@/components/locale-provider';
import { aiT } from '@/components/ai/ai-strings';
import { AnswerText } from '@/components/ai/answer-text';
import { cn } from '@/lib/cn';

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

/** One icon per topic the assistant answers (the suggestions and the side list). */
const TOPIC_ICON: Record<string, ReactNode> = {
  dues: <Wallet />,
  units: <Building2 />,
  sales: <TrendingUp />,
  visits: <CalendarClock />,
};
const SUGGESTION_TOPIC = ['dues', 'units', 'sales', 'visits'];

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

/** The assistant's mark: a gold sparkle in a gold ring on navy. */
function AssistantMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4', md: 'h-12 w-12 [&_svg]:h-5 [&_svg]:w-5', lg: 'h-16 w-16 [&_svg]:h-7 [&_svg]:w-7' }[size];
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#26405F,#0E1626_70%)] text-[#D8B66A] ring-1 ring-[#D8B66A]/50 shadow-[0_10px_30px_-12px_rgba(200,162,75,0.55)]',
        box,
      )}
      aria-hidden
    >
      <Sparkles />
    </span>
  );
}

// The AI assistant: company staff ask about their own data, read-only.
export default function AssistantPage() {
  const locale = useClientLocale();
  const m = useMemo(() => aiT(locale), [locale]);
  const c = m.chat;
  const [status, setStatus] = useState<Status | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTurns(loadChat());
    void fetch('/api-proxy/ai/status')
      .then(async (r) => (r.ok ? ((await r.json()) as Status) : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    saveChat(turns);
    if (turns.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
      setRemaining(data.usage.remaining);
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
  const started = turns.length > 0;

  /** The question box: one rounded field with the send button inside it. */
  const composer = (onDark: boolean) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void ask(input);
      }}
      className="flex flex-col gap-2"
    >
      {error && (
        <p role="alert" data-testid="ai-chat-error" className={cn('text-sm', onDark ? 'text-[#F2B8B5]' : 'text-danger-700')}>
          {error}
        </p>
      )}
      <div
        className={cn(
          'flex items-end gap-2 rounded-[22px] p-2 transition',
          onDark
            ? 'bg-white/[0.07] ring-1 ring-inset ring-white/15 focus-within:ring-[#D8B66A]/60'
            : 'border border-hairline bg-surface shadow-soft focus-within:border-brand-400',
        )}
      >
        <textarea
          ref={boxRef}
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(input);
            }
          }}
          rows={onDark ? 2 : 1}
          maxLength={2000}
          placeholder={c.placeholder}
          aria-label={c.placeholder}
          disabled={!canAsk && !pending}
          className={cn(
            'min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none disabled:opacity-60',
            onDark ? 'text-white placeholder:text-white/45' : 'text-slate-900 placeholder:text-slate-400',
          )}
        />
        <button
          type="submit"
          disabled={!canAsk || !input.trim()}
          aria-label={c.send}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#D8B66A] to-[#B38B3A] text-[#1A1408] shadow-[0_8px_20px_-8px_rgb(179_139_58/0.65)] transition hover:from-[#DFC07A] hover:to-[#BC9442] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ArrowUp className="h-[18px] w-[18px]" />}
        </button>
      </div>
      <p className={cn('px-2 text-[12px]', onDark ? 'text-white/45' : 'text-slate-400')}>
        {c.keyHint}
        {remaining != null && <span className="tabular-nums"> · {c.remaining(remaining)}</span>}
      </p>
    </form>
  );

  const statusPill = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white/80 ring-1 ring-inset ring-white/10">
      <span className={cn('h-1.5 w-1.5 rounded-full', status?.available === false ? 'bg-warning-500' : 'bg-success-500')} />
      {status?.available === false ? c.offline : c.online}
    </span>
  );
  const readOnlyPill = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white/80 ring-1 ring-inset ring-white/10">
      <Lock className="h-3 w-3" />
      {c.readOnly}
    </span>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {/* The console: navy, gold glow; the greeting, the box and the suggestions before the first question. */}
        <section className="relative overflow-hidden rounded-[28px] bg-navy-band text-white shadow-[0_24px_60px_-30px_rgba(14,22,38,0.8)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_100%_0%,rgba(216,182,106,0.20),transparent_60%),radial-gradient(55%_80%_at_0%_100%,rgba(38,64,95,0.85),transparent)]" />
          <div className={cn('relative p-6 sm:p-8', started && 'sm:py-6')}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <AssistantMark size={started ? 'md' : 'lg'} />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold tracking-wide text-[#D8B66A]">{c.eyebrow}</p>
                  <h1 className="mt-1 font-heading text-[28px] font-bold leading-tight !text-white sm:text-[34px]">{m.title}</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {statusPill}
                {readOnlyPill}
                {started && (
                  <button
                    type="button"
                    onClick={() => setTurns([])}
                    disabled={pending}
                    className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {c.clear}
                  </button>
                )}
              </div>
            </div>

            {blocked && (
              <div
                role="status"
                data-testid="ai-unavailable"
                className="mt-6 flex items-start gap-3 rounded-2xl bg-white/[0.06] px-4 py-3.5 ring-1 ring-inset ring-[#D8B66A]/30"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/15 text-[#D8B66A]">
                  <Lock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[14px] font-bold text-white">{c.unavailableTitle}</p>
                  <p className="mt-0.5 text-[13px] text-white/65">{blocked}</p>
                </div>
              </div>
            )}

            {!started && (
              <div className="mt-8 flex flex-col gap-6">
                <div>
                  <h2 className="font-heading text-[24px] font-bold !text-white sm:text-[28px]">{c.greeting}</h2>
                  <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-white/60">{c.description}</p>
                </div>
                {composer(true)}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="ai-suggestions">
                  {c.suggestions.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!canAsk}
                      onClick={() => void ask(s)}
                      className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 text-start ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] hover:ring-[#D8B66A]/50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D8B66A]/12 text-[#D8B66A] ring-1 ring-inset ring-[#D8B66A]/25 [&_svg]:h-4 [&_svg]:w-4">
                        {TOPIC_ICON[SUGGESTION_TOPIC[i] ?? 'sales']}
                      </span>
                      <span className="text-[14px] font-medium text-white/85 group-hover:text-white">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* The conversation, once it has begun. */}
        {started && (
          <section className="flex min-h-[460px] flex-col overflow-hidden rounded-[24px] border border-hairline bg-surface shadow-soft">
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 sm:px-7" aria-live="polite" data-testid="ai-chat">
              {turns.map((t, k) =>
                t.role === 'user' ? (
                  <div key={k} className="flex justify-start">
                    <div
                      dir="auto"
                      aria-label={c.you}
                      className="max-w-[80%] rounded-[20px] rounded-ss-md bg-navy px-4 py-3 dark:bg-navy-600 dark:ring-1 dark:ring-inset dark:ring-white/10 text-[14.5px] leading-relaxed text-white shadow-soft"
                    >
                      <p className="whitespace-pre-wrap">{t.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={k} className="flex items-start justify-end gap-3">
                    <div className="max-w-[85%] min-w-0">
                      <p className="mb-1.5 text-[12px] font-bold text-brand-700">{c.assistant}</p>
                      <div
                        dir="auto"
                        aria-label={c.assistant}
                        className="rounded-[20px] rounded-se-md border border-hairline bg-surface-sunken px-5 py-4 text-[14.5px] leading-relaxed text-slate-800"
                      >
                        <AnswerText text={t.content} />
                      </div>
                    </div>
                    <AssistantMark size="sm" />
                  </div>
                ),
              )}
              {pending && (
                <div className="flex items-start justify-end gap-3">
                  <div className="inline-flex items-center gap-2 rounded-[20px] rounded-se-md border border-hairline bg-surface-sunken px-4 py-3 text-[13.5px] text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    {c.thinking}
                  </div>
                  <AssistantMark size="sm" />
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="border-t border-hairline bg-surface-muted/60 px-4 py-4 sm:px-6">{composer(false)}</div>
          </section>
        )}
      </div>

      {/* What it answers, and its rules. */}
      <aside className="flex flex-col gap-6">
        <PremiumPanel title={c.canTitle}>
          <ul className="flex flex-col gap-4">
            {c.can.map((x) => (
              <li key={x.k} className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-400/40 bg-brand-50 text-brand-700 [&_svg]:h-4 [&_svg]:w-4">
                  {TOPIC_ICON[x.k]}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-900">{x.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">{x.line}</p>
                </div>
              </li>
            ))}
          </ul>
        </PremiumPanel>
        <PremiumPanel title={c.rulesTitle}>
          <ul className="flex flex-col gap-3">
            {c.rules.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[13.5px] text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                {r}
              </li>
            ))}
          </ul>
        </PremiumPanel>
      </aside>
    </div>
  );
}
