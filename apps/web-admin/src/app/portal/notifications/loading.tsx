import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/notifications while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'card', h: 640, list: true },
  { t: 'table', cols: 3, rows: 4, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
