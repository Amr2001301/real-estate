import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/team while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'figures', n: 4 },
  { t: 'filter' },
  { t: 'card', h: 175, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
