import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/projects/[id]/content while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 148 },
  { t: 'card', h: 495, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
