import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/inventory while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 2, h: 114 },
  { t: 'navy', n: 4 },
  { t: 'filter' },
  { t: 'table', cols: 7, rows: 5, head: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
