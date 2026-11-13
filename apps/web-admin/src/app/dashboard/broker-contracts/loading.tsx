import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/broker-contracts while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'figures', n: 4 },
  { t: 'filter' },
  { t: 'card', h: 541, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
