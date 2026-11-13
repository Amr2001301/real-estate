import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/units/types while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'card', h: 178, list: false },
  { t: 'card', h: 640, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
