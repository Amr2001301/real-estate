import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/super-admin while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'navy', n: 4 },
  { t: 'table', cols: 7, rows: 5, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
