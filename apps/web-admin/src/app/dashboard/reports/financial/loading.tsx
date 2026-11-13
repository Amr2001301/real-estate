import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/reports/financial while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'card', h: 40, list: false },
  { t: 'card', h: 135, list: false },
  { t: 'card', h: 377, list: false },
  { t: 'card', h: 171, list: false },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 sm:grid-cols-3',
    cols: [{ h: [157] }, { h: [157] }, { h: [157] }],
  },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6',
    cols: [
      { s: 'lg:col-span-3', h: [471] },
      { s: 'lg:col-span-2', h: [471] },
    ],
  },
  { t: 'table', cols: 7, rows: 6, head: true },
  { t: 'card', h: 231, list: true },
  { t: 'card', h: 181, list: false },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3 lg:gap-6',
    cols: [{ h: [347] }, { h: [347] }, { h: [347] }],
  },
  { t: 'table', cols: 7, rows: 8, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
