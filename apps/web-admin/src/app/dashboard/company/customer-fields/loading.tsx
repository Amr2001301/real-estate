import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/company/customer-fields while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'card', h: 565, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
