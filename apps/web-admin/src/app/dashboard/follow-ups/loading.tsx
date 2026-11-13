import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/follow-ups while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 141 },
  { t: 'card', h: 43, list: false },
  { t: 'card', h: 640, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
