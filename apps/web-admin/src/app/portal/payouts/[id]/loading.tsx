import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/payouts/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 116 },
  { t: 'table', cols: 5, rows: 2, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
