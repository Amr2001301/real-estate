import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/payments/review while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 105 },
  { t: 'card', h: 111, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
