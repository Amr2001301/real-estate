import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/contracts/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 150 },
  { t: 'figures', n: 4 },
  { t: 'tabs', n: 5 },
  { t: 'table', cols: 7, rows: 8, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
