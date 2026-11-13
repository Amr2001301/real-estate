import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/notifications/broadcast while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]',
    cols: [{ h: [342, 237, 342, 147] }, { h: [234, 365] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
