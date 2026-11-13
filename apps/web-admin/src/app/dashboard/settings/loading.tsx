import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/settings while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 152 },
  { t: 'card', h: 159, list: true },
  { t: 'card', h: 158, list: true },
  { t: 'card', h: 534, list: true },
  { t: 'card', h: 158, list: true },
  { t: 'card', h: 309, list: true },
  { t: 'card', h: 534, list: true },
  { t: 'card', h: 233, list: true },
  { t: 'card', h: 158, list: true },
  { t: 'card', h: 158, list: true },
  { t: 'card', h: 233, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
