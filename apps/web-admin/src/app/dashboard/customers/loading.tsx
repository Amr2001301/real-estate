import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/customers while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'navy', n: 4 },
  { t: 'filter' },
  { t: 'table', cols: 6, rows: 8, head: true },
  { t: 'card', h: 57, list: false },
  { t: 'card', h: 44, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
