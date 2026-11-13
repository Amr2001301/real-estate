import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/super-admin/ai while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'card', h: 182, list: false },
  { t: 'card', h: 182, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
