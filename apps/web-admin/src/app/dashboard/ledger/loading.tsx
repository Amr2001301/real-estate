import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/ledger while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'navy', n: 3 },
  { t: 'card', h: 104, list: false },
  { t: 'grid', cls: 'grid gap-5 xl:grid-cols-2', cols: [{ h: [521] }, { h: [521] }] },
  { t: 'table', cols: 7, rows: 8, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
