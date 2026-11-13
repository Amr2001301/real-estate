import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/performance while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'filter' },
  { t: 'figures', n: 6 },
  { t: 'card', h: 479, list: true },
  { t: 'card', h: 287, list: true },
  { t: 'card', h: 189, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
