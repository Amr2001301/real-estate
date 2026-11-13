import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/projects/[id]/prices while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 138 },
  { t: 'table', cols: 5, rows: 5, head: true },
  { t: 'card', h: 212, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
