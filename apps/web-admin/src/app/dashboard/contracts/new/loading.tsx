import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/contracts/new while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 175 },
  { t: 'card', h: 122, form: true },
  { t: 'card', h: 640, form: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
