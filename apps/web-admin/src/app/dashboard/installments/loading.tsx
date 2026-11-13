import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/installments while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'navy', n: 4 },
  { t: 'filter' },
  { t: 'table', cols: 8, rows: 8, head: true },
  { t: 'card', h: 57, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
