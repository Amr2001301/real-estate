import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/reservations while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'figures', n: 5 },
  { t: 'card', h: 46, list: false },
  { t: 'filter' },
  { t: 'card', h: 640, list: true },
  { t: 'card', h: 57, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
