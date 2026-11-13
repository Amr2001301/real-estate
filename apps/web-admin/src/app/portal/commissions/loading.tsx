import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/commissions while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'figures', n: 5 },
  { t: 'filter' },
  { t: 'card', h: 258, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
