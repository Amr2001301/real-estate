import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/security while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 141 },
  { t: 'card', h: 381, list: true },
  { t: 'card', h: 216, list: false },
  { t: 'card', h: 379, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
