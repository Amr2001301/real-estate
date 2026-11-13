import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/projects while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'navy', n: 4 },
  { t: 'card', h: 108, list: false },
  { t: 'table', cols: 6, rows: 6, head: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
