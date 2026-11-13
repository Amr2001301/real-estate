import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/super-admin/companies/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 146 },
  { t: 'table', cols: 4, rows: 8, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
