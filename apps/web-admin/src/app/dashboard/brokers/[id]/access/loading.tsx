import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/brokers/[id]/access while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 152 },
  { t: 'card', h: 46, list: false },
  { t: 'card', h: 481, list: false },
  { t: 'card', h: 240, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
