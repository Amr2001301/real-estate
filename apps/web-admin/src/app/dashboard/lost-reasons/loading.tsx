import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/lost-reasons while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 141 },
  { t: 'navy', n: 4 },
  { t: 'card', h: 42, list: false },
  { t: 'card', h: 137, list: true },
  { t: 'table', cols: 3, rows: 5, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
