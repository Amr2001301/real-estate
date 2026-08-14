'use client';

import { useState, useEffect, useRef } from 'react';
import { Share2, Link2, Check } from 'lucide-react';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface ShareButtonProps {
  /** Text that prefixes the URL in the WhatsApp message and the native share title. */
  title: string;
  /** Visual variant — hero is used inside gallery overlays (frosted-glass style). */
  variant?: 'hero' | 'card';
}

/**
 * Share the current page URL.
 * - Mobile: delegates to the native Web Share API (system share sheet).
 * - Desktop: shows a small dropdown with "Copy link" + "Share on WhatsApp".
 */
export function ShareButton({ title, variant = 'hero' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  async function handleShare() {
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or browser doesn't support — fall through to dropdown.
      }
    }
    setOpen((v) => !v);
  }

  async function copyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Legacy fallback for browsers without clipboard API.
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  const waHref = () =>
    `https://wa.me/?text=${encodeURIComponent(`${title}\n${window.location.href}`)}`;

  const isHero = variant === 'hero';

  const triggerCls = isHero
    ? 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50'
    : 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors duration-200 hover:border-gold-300 hover:bg-gold-50 hover:text-gold-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleShare}
        aria-label="مشاركة"
        aria-expanded={open}
        className={triggerCls}
      >
        {copied
          ? <Check className="h-4 w-4 text-emerald-400" />
          : <Share2 className="h-4 w-4" />
        }
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-2 min-w-[190px] overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_8px_32px_-8px_rgba(11,23,38,0.22)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-ink-strong transition-colors hover:bg-gold-50"
          >
            {copied
              ? <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              : <Link2 className="h-4 w-4 shrink-0 text-gold-500" />
            }
            نسخ الرابط
          </button>
          <div className="mx-3 h-px bg-hairline" />
          <a
            href={waHref()}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-ink-strong transition-colors hover:bg-[#25D366]/[0.06]"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#25D366]" />
            مشاركة على واتساب
          </a>
        </div>
      )}
    </div>
  );
}
