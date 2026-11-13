import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/campaigns/report while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 2, h: 141 },
  { t: 'card', h: 137, list: true },
  { t: 'card', h: 207, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
