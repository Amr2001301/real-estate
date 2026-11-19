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
import { useClientLocale } from '@/components/locale-provider';
import { aiT, type AiPlanView } from '@/components/ai/ai-strings';
import { formatDate } from '@/lib/format';
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
  // The company's plan, for admins only (the API refuses everyone else).
  const [plan, setPlan] = useState<AiPlanView | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTurns(loadChat());
    void fetch('/api-proxy/ai/status')
      .then(async (r) => (r.ok ? ((await r.json()) as Status) : null))
      .then(setStatus)
      .catch(() => setStatus(null));
    void fetch('/api-proxy/ai/usage')
      .then(async (r) => (r.ok ? ((await r.json()) as { enabled: boolean } & Partial<AiPlanView>) : null))
      .then((u) => setPlan(u && u.enabled ? (u as AiPlanView) : null))
      .catch(() => setPlan(null));
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
          'flex items-end gap-2 rounded-card p-2 transition',
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

  const questionsLeft = remaining ?? plan?.remaining ?? null;
  const card = 'rounded-[22px] border border-hairline bg-surface p-[22px] shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none';
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      {/* One console: a fixed header, the body that scrolls, the box always at the bottom. */}
      <section className="relative flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-[24px] bg-navy-band text-white shadow-[0_24px_60px_-30px_rgba(14,22,38,0.8)] xl:h-[calc(100dvh-150px)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_100%_0%,rgba(216,182,106,0.16),transparent_60%),radial-gradient(55%_80%_at_0%_100%,rgba(38,64,95,0.85),transparent)]" />
        <header className="relative flex flex-wrap items-center gap-3.5 border-b border-white/[0.08] px-6 py-[18px]">
          <AssistantMark size="md" />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold tracking-wide text-[#D8B66A]">{c.eyebrow}</p>
            <h1 className="mt-0.5 font-heading text-[22px] font-bold leading-tight !text-white">{m.title}</h1>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {statusPill}
            {readOnlyPill}
            {started && (
              <button
                type="button"
                onClick={() => setTurns([])}
                disabled={pending}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#EAD5A3_0%,#C8A24B_48%,#9E7A2B_100%)] px-3.5 text-[12.5px] font-bold text-[#0B1220] transition hover:brightness-105 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {c.clear}
              </button>
            )}
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          {blocked && (
            <div
              role="status"
              data-testid="ai-unavailable"
              className="m-6 flex flex-col items-center gap-2 rounded-[20px] bg-white/[0.05] px-6 py-8 text-center ring-1 ring-inset ring-[#D8B66A]/30"
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#D8B66A]/12 text-[#D8B66A] ring-1 ring-inset ring-[#D8B66A]/30">
                <Lock className="h-6 w-6" />
              </span>
              <p className="mt-2 text-[20px] font-bold text-white">{c.unavailableTitle}</p>
              <p className="max-w-md text-[13.5px] leading-[1.8] text-white/65">{blocked}</p>
              {status?.reason !== 'NOT_CONFIGURED' && (
                <span className="mt-2 inline-flex h-10 items-center rounded-xl bg-[linear-gradient(135deg,#EAD5A3_0%,#C8A24B_48%,#9E7A2B_100%)] px-5 text-[13px] font-bold text-[#0B1220]">
                  {c.contactAdmin}
                </span>
              )}
            </div>
          )}

          {!started && blocked ? (
            // Not available: the notice above says why; the topics it will answer, as plain chips.
            <div className="flex flex-wrap justify-center gap-2.5 px-6 pb-6">
              {c.can.map((x) => (
                <span key={x.k} className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.05] px-3.5 text-[12.5px] text-white/75 ring-1 ring-inset ring-white/10 [&_svg]:h-3.5 [&_svg]:w-3.5">
                  {TOPIC_ICON[x.k]}
                  {x.title}
                </span>
              ))}
            </div>
          ) : !started ? (
            <div className="flex flex-1 flex-col justify-center px-6 py-7 sm:px-10">
              <h2 className="font-heading text-[28px] font-bold !text-white">{c.greeting}</h2>
              <p className="mt-2 max-w-xl text-[14px] leading-[1.7] text-white/60">{c.description}</p>
              <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2" data-testid="ai-suggestions">
                {c.suggestions.map((sug, i) => {
                  const topic = c.can[i];
                  return (
                    <button
                      key={sug}
                      type="button"
                      disabled={!canAsk}
                      onClick={() => void ask(sug)}
                      className="group flex flex-col gap-3 rounded-[18px] bg-white/[0.04] px-[18px] py-4 text-start ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] hover:ring-[#D8B66A]/50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#D8B66A]/12 text-[#D8B66A] ring-1 ring-inset ring-[#D8B66A]/25 [&_svg]:h-4 [&_svg]:w-4">
                          {TOPIC_ICON[SUGGESTION_TOPIC[i] ?? 'sales']}
                        </span>
                        <span className="text-[14px] font-bold text-white">{topic?.title}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2 rounded-[11px] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white/85 group-hover:text-white">
                        {sug}
                        <span aria-hidden className="text-[#D8B66A] ltr:rotate-180">←</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-5 px-6 py-6 sm:px-10" aria-live="polite" data-testid="ai-chat">
              {turns.map((t, k) =>
                t.role === 'user' ? (
                  <div key={k} className="flex justify-start">
                    <div
                      dir="auto"
                      aria-label={c.you}
                      className="max-w-[75%] rounded-[20px] rounded-ss-md bg-[#1E2C47] px-4 py-3 text-[14.5px] leading-relaxed text-white ring-1 ring-inset ring-white/10"
                    >
                      <p className="whitespace-pre-wrap">{t.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={k} className="flex items-start justify-end gap-3">
                    <div className="min-w-0 max-w-[85%]">
                      <p className="mb-1.5 text-[12px] font-bold text-[#D8B66A]">{c.assistant}</p>
                      <div
                        dir="auto"
                        aria-label={c.assistant}
                        className="rounded-[20px] rounded-se-md bg-[#FFFDF8] px-5 py-4 text-[14.5px] leading-[1.85] text-slate-800"
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
                  <div className="inline-flex items-center gap-2 rounded-[20px] rounded-se-md bg-white/[0.07] px-4 py-3 text-[13.5px] text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin text-[#D8B66A]" />
                    {c.thinking}
                  </div>
                  <AssistantMark size="sm" />
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="relative border-t border-white/[0.08] bg-black/10 px-6 pb-4 pt-4">{composer(true)}</div>
      </section>

      <aside className="flex flex-col gap-5">
        {plan && (
          <section className={card} data-testid="ai-plan-card">
            <h3 className="font-heading text-[16px] font-semibold text-slate-900">{c.plan.title}</h3>
            <p className="mt-1 text-[12px] text-slate-500">{[plan.packageName, c.plan.ends(formatDate(plan.periodEnd, locale))].filter(Boolean).join(' · ')}</p>
            <p className="num mt-4 font-heading text-[30px] font-bold leading-none text-slate-900">{questionsLeft ?? plan.remaining}</p>
            <p className="mt-1.5 text-[12.5px] text-slate-500">{c.plan.left(questionsLeft ?? plan.remaining, plan.quota)}</p>
            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-[linear-gradient(135deg,#EAD5A3_0%,#C8A24B_48%,#9E7A2B_100%)]"
                style={{ width: `${plan.quota > 0 ? Math.min(100, Math.max(0, (((plan.quota - (questionsLeft ?? plan.remaining)) / plan.quota) * 100))) : 0}%` }}
              />
            </div>
          </section>
        )}
        <section className={card}>
          <h3 className="font-heading text-[16px] font-semibold text-slate-900">{c.rulesTitle}</h3>
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {c.rules.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[13px] text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#B38B3A]" />
                {r}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
