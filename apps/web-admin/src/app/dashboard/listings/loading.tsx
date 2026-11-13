import { PageSkeleton } from '@/components/ui/skeletons';

/** «الوحدات المعروضة» while it loads: hero, the navy band, kind tabs, filters, cards. */
export default function ListingsLoading() {
  return <PageSkeleton parts={[{ t: 'hero', a: 1, h: 150 }, { t: 'navy', n: 4 }, { t: 'tabs', n: 4 }, { t: 'filter' }, { t: 'grid', cls: 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3', cols: [{ h: [380] }, { h: [380] }, { h: [380] }] }]} />;
}
