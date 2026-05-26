'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bath, BedDouble, ChevronLeft, ExternalLink, MapPin, Ruler, ThumbsDown, ThumbsUp } from 'lucide-react';
import { CoverImage } from '@/components/ui/CoverImage';
import { cn } from '@/lib/cn';
import { getWhatsappPhone, whatsappHref } from '@/lib/contact';
import type { ChatCard, ChatCta, ChatUiMessage, FeedbackRating } from '@/lib/chat';

interface ChatMessageProps {
  message: ChatUiMessage;
  onFeedback?: (messageId: string, rating: FeedbackRating) => void;
}

export function ChatMessage({ message, onFeedback }: ChatMessageProps) {
  const isUser = message.role === 'USER';
  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-start' : 'items-stretch')}>
      <div
        className={cn(
          'max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed',
          isUser
            ? 'self-start bg-navy text-white shadow-soft'
            : 'self-end bg-surface-soft text-ink',
        )}
      >
        {message.content}
      </div>

      {message.cards && message.cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {message.cards.map((card) => (
            <ChatResultCard key={`${card.type}-${card.id}`} card={card} />
          ))}
        </div>
      )}

      {message.ctas && message.ctas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.ctas.map((cta, i) => (
            <ChatCtaButton key={`${cta.kind}-${i}`} cta={cta} />
          ))}
        </div>
      )}

      {!isUser && message.serverId && onFeedback && (
        <FeedbackButtons messageId={message.id} onFeedback={onFeedback} />
      )}
    </div>
  );
}

function ChatResultCard({ card }: { card: ChatCard }) {
  return (
    <Link
      href={card.href}
      className="group flex gap-3 rounded-2xl border border-hairline bg-surface p-2.5 shadow-soft transition-all duration-200 hover:border-gold-300 hover:shadow-card"
    >
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl">
        <CoverImage src={card.imageUrl} alt={card.title} imgClassName="h-full w-full object-cover" zoomOnHover />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="truncate text-[14px] font-semibold text-ink-strong">{card.title}</p>
        {card.subtitle && <p className="truncate text-xs text-ink-muted">{card.subtitle}</p>}
        {card.type === 'unit' ? (
          <UnitMeta card={card} />
        ) : (
          card.city && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {card.city}
            </span>
          )
        )}
      </div>
      <ChevronLeft className="h-4 w-4 shrink-0 self-center text-ink-muted transition-transform group-hover:-translate-x-0.5" aria-hidden />
    </Link>
  );
}

function UnitMeta({ card }: { card: Extract<ChatCard, { type: 'unit' }> }) {
  return (
    <div className="flex flex-col gap-0.5">
      {card.price && <span className="text-[13px] font-semibold text-gold-600">{card.price}</span>}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-ink-muted">
        {card.city && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-3 w-3" aria-hidden /> {card.city}
          </span>
        )}
        {card.bedrooms !== undefined && (
          <span className="inline-flex items-center gap-0.5">
            <BedDouble className="h-3 w-3" aria-hidden /> {card.bedrooms}
          </span>
        )}
        {card.bathrooms !== undefined && (
          <span className="inline-flex items-center gap-0.5">
            <Bath className="h-3 w-3" aria-hidden /> {card.bathrooms}
          </span>
        )}
        {card.area !== undefined && (
          <span className="inline-flex items-center gap-0.5">
            <Ruler className="h-3 w-3" aria-hidden /> {card.area} م²
          </span>
        )}
      </div>
    </div>
  );
}

function ChatCtaButton({ cta }: { cta: ChatCta }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-1';

  // WhatsApp: build the wa.me link on the client from env; backend supplies only
  // the prefilled message. Hide the CTA when no number is configured.
  if (cta.kind === 'whatsapp') {
    const phone = getWhatsappPhone();
    if (!phone) return null;
    return (
      <a
        href={whatsappHref(phone, cta.payload?.message)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(base, 'bg-gold-400 text-navy hover:bg-gold-300')}
      >
        {cta.label}
      </a>
    );
  }

  const href = cta.href ?? '';
  const styles = cn(base, 'border border-hairline text-ink-strong hover:border-gold-300 hover:bg-navy/[0.04]');
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={styles}>
        {cta.label}
      </Link>
    );
  }
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles}>
      {cta.label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

function FeedbackButtons({
  messageId,
  onFeedback,
}: {
  messageId: string;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}) {
  const [rated, setRated] = useState<FeedbackRating | null>(null);
  const rate = (rating: FeedbackRating) => {
    if (rated) return;
    setRated(rating);
    onFeedback(messageId, rating);
  };
  return (
    <div className="flex items-center gap-1 self-end pe-1">
      <button
        type="button"
        onClick={() => rate('UP')}
        aria-label="إجابة مفيدة"
        aria-pressed={rated === 'UP'}
        disabled={rated !== null}
        className={cn(
          'rounded-full p-1 text-ink-muted transition-colors hover:text-success disabled:cursor-default',
          rated === 'UP' && 'text-success',
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => rate('DOWN')}
        aria-label="إجابة غير مفيدة"
        aria-pressed={rated === 'DOWN'}
        disabled={rated !== null}
        className={cn(
          'rounded-full p-1 text-ink-muted transition-colors hover:text-error disabled:cursor-default',
          rated === 'DOWN' && 'text-error',
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
