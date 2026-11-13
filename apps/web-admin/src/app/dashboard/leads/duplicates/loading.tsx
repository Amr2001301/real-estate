import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/leads/duplicates while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 141 },
  { t: 'card', h: 207, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
