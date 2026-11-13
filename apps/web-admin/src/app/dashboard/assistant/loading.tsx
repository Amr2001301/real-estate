import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/assistant while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 82 },
  { t: 'card', h: 46, list: false },
  { t: 'card', h: 420, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
