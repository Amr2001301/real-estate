import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/payouts while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'figures', n: 5 },
  { t: 'filter' },
  { t: 'card', h: 168, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
