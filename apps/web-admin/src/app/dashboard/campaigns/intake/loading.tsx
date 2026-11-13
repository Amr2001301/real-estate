import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/campaigns/intake while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 166 },
  { t: 'navy', n: 4 },
  { t: 'card', h: 255, list: false },
  { t: 'card', h: 306, list: false },
  { t: 'table', cols: 5, rows: 7, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
