'use client';

import { useEffect, useRef } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { CHAT_MAX_LENGTH, type ChatUiMessage, type FeedbackRating } from '@/lib/chat';
import { ChatMessage } from './ChatMessage';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatUiMessage[];
  quickReplies: string[];
  pending: boolean;
  restoring: boolean;
  error: string | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
  onQuickReply: (text: string) => void;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const { open, onClose, messages, quickReplies, pending, restoring, error } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Autoscroll to the newest message / typing indicator.
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [open, messages, pending, restoring]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onSend();
  };

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="إغلاق المحادثة"
        onClick={onClose}
        className="fixed inset-0 z-[65] bg-navy/40 backdrop-blur-sm sm:hidden"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="المساعد العقاري"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className={cn(
          'fixed z-[70] flex flex-col overflow-hidden border border-hairline bg-canvas shadow-lift',
          // Mobile: bottom sheet, near-full height. Desktop: docked panel (RTL → left).
          'inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl',
          'sm:inset-x-auto sm:bottom-6 sm:left-6 sm:h-[600px] sm:max-h-[80vh] sm:w-[400px] sm:rounded-3xl',
        )}
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-600">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink-strong">المساعد العقاري</p>
            <p className="truncate text-xs text-ink-muted">مساعد ذكي مجاني للبحث والاستفسار</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-navy/[0.05] hover:text-ink-strong"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} onFeedback={props.onFeedback} />
          ))}

          {(pending || restoring) && <TypingIndicator />}

          {error && (
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-2xl border border-error/30 bg-error/5 px-3.5 py-2.5 text-[13px] text-error">
                {error}
              </div>
              <button
                type="button"
                onClick={props.onRetry}
                className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-ink-strong hover:border-gold-300"
              >
                إعادة المحاولة
              </button>
            </div>
          )}
        </div>

        {/* Quick replies */}
        {quickReplies.length > 0 && !pending && (
          <div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-2.5">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => props.onQuickReply(q)}
                className="rounded-full border border-gold-300/50 bg-gold-400/10 px-3 py-1.5 text-[13px] font-medium text-gold-600 transition-colors hover:bg-gold-400/20"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-hairline bg-surface px-3 py-3">
          <Input
            ref={inputRef}
            value={props.input}
            onChange={(e) => props.onInputChange(e.target.value)}
            maxLength={CHAT_MAX_LENGTH}
            placeholder="اكتب رسالتك…"
            aria-label="اكتب رسالتك"
            autoComplete="off"
            disabled={restoring}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="gold"
            size="md"
            aria-label="إرسال"
            disabled={pending || restoring || props.input.trim().length === 0}
            className="shrink-0 !px-3"
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </div>
    </>
  );
}

/** Reuses the shared `.skeleton` shimmer as a calm "assistant is typing" cue. */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 self-end rounded-2xl bg-surface-soft px-4 py-3" aria-hidden>
      <span className="skeleton h-2 w-2 rounded-full" />
      <span className="skeleton h-2 w-2 rounded-full" />
      <span className="skeleton h-2 w-2 rounded-full" />
      <span className="sr-only">جارٍ كتابة الرد…</span>
    </div>
  );
}
