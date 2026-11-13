import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/leads/import while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 70 },
  { t: 'card', h: 46, list: false },
  { t: 'card', h: 252, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
