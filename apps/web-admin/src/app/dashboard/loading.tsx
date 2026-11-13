import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';
import { getSession } from '@/lib/session';

/** The admin's home (cockpit): hero, the action queue, the day, then panels in columns. */
const ADMIN: SkeletonPart[] = [
  { t: 'hero', a: 3, h: 150 },
  { t: 'navy', n: 5 },
  { t: 'card', h: 176, list: true },
  { t: 'card', h: 485, list: true },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3',
    cols: [{ s: 'lg:col-span-2', h: [560, 336] }, { h: [251, 200, 458] }],
  },
  { t: 'card', h: 465, list: true },
];

/** A sales rep's / manager's day: the day header, six figures, the agenda beside tasks (and the pipeline). */
const DAY = (side: number[]): SkeletonPart[] => [
  { t: 'hero', a: 2, h: 150 },
  { t: 'figures', n: 6 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start',
    cols: [{ s: 'xl:col-span-2', h: [520] }, { h: side }],
  },
];

/** The dashboard home while it loads, in the shape of the home this role gets. */
export default async function DashboardHomeLoading() {
  const role = (await getSession())?.role;
  const parts = role === 'SALES' ? DAY([360]) : role === 'SALES_MANAGER' ? DAY([300, 260]) : ADMIN;
  return <PageSkeleton parts={parts} />;
}
