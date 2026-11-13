import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/campaigns while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 3, h: 141 },
  { t: 'card', h: 363, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
