import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/maintenance while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 2, h: 114 },
  { t: 'navy', n: 4 },
  { t: 'filter' },
  { t: 'table', cols: 7, rows: 8, head: true },
  { t: 'card', h: 57, list: false },
  { t: 'card', h: 346, list: true },
  { t: 'card', h: 493, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
