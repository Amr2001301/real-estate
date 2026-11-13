import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/projects/[id]/edit while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 148 },
  { t: 'card', h: 640, form: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
