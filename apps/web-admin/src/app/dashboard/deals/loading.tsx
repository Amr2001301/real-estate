import { PageSkeleton } from '@/components/ui/skeletons';

/** «الصفقات والعمولات» while it loads: hero, the navy band, tabs, filters, the deals. */
export default function DealsLoading() {
  return <PageSkeleton parts={[{ t: 'hero', a: 1, h: 150 }, { t: 'navy', n: 4 }, { t: 'tabs', n: 4 }, { t: 'tabs', n: 4 }, { t: 'filter' }, { t: 'table', cols: 5, rows: 6, head: true }]} />;
}
