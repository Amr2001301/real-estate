import { Container } from '@/components/ui/Container';

/** Branded route-loading skeleton — warm, not a cold grey flash. */
export default function Loading() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24">
      <span className="relative inline-flex h-12 w-12">
        <span className="absolute inline-flex h-full w-full rounded-full bg-gold-200/60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-400">
          <span className="h-3 w-3 rounded-full bg-navy" />
        </span>
      </span>
      <p className="text-ink-muted">جارٍ التحميل…</p>
    </Container>
  );
}
