import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/campaigns/[id]/edit while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [{ t: 'card', h: 68, form: true }];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
