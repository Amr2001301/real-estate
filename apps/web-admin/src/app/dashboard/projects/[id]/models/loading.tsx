import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/projects/[id]/models while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 138 },
  { t: 'card', h: 406, list: false },
  { t: 'card', h: 134, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
