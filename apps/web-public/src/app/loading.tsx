import { Container } from '@/components/ui/Container';

/**
 * GLOBAL root loading fallback — shown for any route while its segment/layout
 * is still resolving and no closer loading boundary has engaged yet (e.g. the
 * brief window while the async /account layout resolves). It must be
 * route-AGNOSTIC, so it's a neutral branded loader rather than a page-shaped
 * skeleton — each route has its own loading.tsx with a matching skeleton.
 */
export default function Loading() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24">
      <span className="relative inline-flex h-12 w-12" role="status" aria-label="جارٍ التحميل">
        <span className="absolute inline-flex h-full w-full rounded-full bg-gold-200/60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-400">
          <span className="h-3 w-3 rounded-full bg-navy" />
        </span>
      </span>
      <p className="text-ink-muted">جارٍ التحميل…</p>
    </Container>
  );
}
