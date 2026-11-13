import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/installments/new while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 105 },
  { t: 'table', cols: 6, rows: 5, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
