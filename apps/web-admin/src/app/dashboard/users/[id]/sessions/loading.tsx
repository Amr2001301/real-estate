import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/users/[id]/sessions while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 141 },
  { t: 'card', h: 128, list: false },
  { t: 'card', h: 177, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
