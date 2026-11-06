import { PremiumPageHero } from '@/components/premium';
import { CompareView, type CompareData } from '../_components/compare-view';

export const dynamic = 'force-dynamic';

const up = (n: number) => n;
const data: CompareData = {
  periodLabel: 'نوفمبر 2026',
  prevLabel: 'أكتوبر 2026',
  band: [
    { label: 'المحصّل من الدفعات', value: '2.56', unit: 'مليون ج.م', sub: 'مقابل 3.73 مليون في أكتوبر', trend: '↓ 31٪ · 1.17 مليون', trendCls: 'danger' },
    { label: 'عدد المدفوعات', value: '13', unit: 'دفعة', sub: 'مقابل 25 في أكتوبر', trend: '↓ 12 دفعة', trendCls: 'danger' },
    { label: 'معدل التحصيل', value: "86", unit: '%', ring: 86, sub: 'مقابل 91% في أكتوبر', trend: '↓ 5 نقاط', trendCls: 'warning' },
    { label: 'عقود موقّعة', value: "5", unit: 'عقد', sub: 'مقابل 4 في أكتوبر', trend: '↑ 25٪ · عقد واحد', trendCls: 'success' },
    { label: 'متوسط أيام التأخير', value: "21", unit: 'يوم', sub: 'مقابل 16 يومًا في أكتوبر', trend: '↑ 5 أيام', trendCls: 'danger' },
  ],
  insights: [
    { tone: 'bad', title: 'التحصيل', figure: '−31٪', text: 'أقل من الشهر السابق، ومعظمه من مشروعين.' },
    { tone: 'warn', title: 'المتأخرات', figure: '21 يومًا', text: 'متوسط التأخير، كان 16 يومًا.' },
    { tone: 'good', title: 'المبيعات', figure: '+25٪', text: 'خمسة عقود موقّعة مقابل أربعة.' },
    { tone: 'warn', title: 'توقع نهاية الشهر', figure: '3.1 م', text: 'أقل من أكتوبر بـ 17٪ بالوتيرة الحالية.' },
  ],
  rows: [
    { label: 'المحصّل من الدفعات', cur: '2.56 م', prev: '3.73 م', diff: '−1.17 م', pct: '−31%', tone: -1, spark: [3.1, 2.8, 3.5, 3.9, 3.2, 3.7, 2.9, 3.3, 3.6, 3.4, 3.73, 2.56] },
    { label: 'عدد المدفوعات', cur: '13', prev: '25', diff: '−12', pct: '−48%', tone: -1, spark: [20, 22, 19, 26, 24, 23, 25, 21, 27, 24, 25, 13] },
    { label: 'متوسط قيمة الدفعة', cur: '197 ألف', prev: '149 ألف', diff: '+48 ألف', pct: '+32%', tone: 1, spark: [140, 150, 160, 145, 155, 150, 148, 152, 149, 151, 149, 197] },
    { label: 'رسوم وغرامات', cur: '1,500', prev: '0', diff: '+1,500', tone: 1, spark: [0, 2, 0, 0, 5, 0, 0, 0, 3, 0, 0, 1.5] },
    { label: 'عقود موقّعة', cur: '5', prev: '4', diff: '+1', pct: '+25%', tone: 1, spark: [3, 4, 4, 5, 3, 4, 5, 4, 3, 4, 4, 5] },
    { label: 'حجوزات جديدة', cur: '7', prev: '7', diff: 'بدون تغيير', tone: 0, spark: [6, 8, 7, 7, 6, 8, 7, 7, 6, 7, 7, 7] },
    { label: 'معدل التحصيل من المستحق', cur: '86%', prev: '91%', diff: '−5 نقاط', tone: -1, spark: [88, 90, 92, 89, 91, 93, 90, 92, 91, 92, 91, 86] },
  ],
  bridge: {
    from: 3.73, to: 2.56, fromLabel: 'أكتوبر', toLabel: 'نوفمبر',
    steps: [{ label: 'الواحة', value: -0.59 }, { label: 'الرياض', value: -0.17 }, { label: 'نايل كريست', value: -0.28 }, { label: 'أخرى', value: -0.13 }],
  },
  asOf: [{ label: 'المستحق حتى اليوم', value: '18.26 م' }, { label: 'المتأخر', value: '0.47 م', tone: 'danger' }, { label: 'قيمة العقود', value: '122.46 م' }],
  cumulative: (() => {
    const mk = (total: number, seed: number) => {
      let c = 0, s = seed; const out = [0];
      for (let d = 1; d <= 30; d++) { s = (s * 9301 + 49297) % 233280; c += (total / 30) * (0.35 + (s / 233280) * 1.3); out.push(c); }
      return out.map((v) => (v / out[out.length - 1]!) * total);
    };
    return { cur: mk(2.56, 7).slice(0, 27), prev: mk(3.73, 11), pace: Array.from({ length: 31 }, (_, i) => (i / 30) * 3.4) };
  })(),
  aging: [
    { label: '1–30 يومًا', cur: '0.21 م', prev: '0.30 م', diff: '−0.09', tone: 1 },
    { label: '31–60 يومًا', cur: '0.16 م', prev: '0.09 م', diff: '+0.07', tone: -1 },
    { label: '61–90 يومًا', cur: '0.07 م', prev: '0.04 م', diff: '+0.03', tone: -1 },
    { label: 'أكثر من 90 يومًا', cur: '0.03 م', prev: '0.03 م', diff: '0', tone: 0 },
  ],
  splits: [
    { title: 'حسب المشروع', sub: 'المحصّل بالمليون ج.م', unit: 'م', rows: [
      { name: 'الواحة ريزيدنس', cur: 1.02, prev: 1.61 }, { name: 'كمبوند الرياض الجديدة', cur: 0.71, prev: 0.88 },
      { name: 'نايل كريست', cur: 0.46, prev: 0.74 }, { name: 'سولارا هايتس', cur: 0.25, prev: 0.31 }] },
    { title: 'حسب نوع الدفعة', sub: 'المحصّل بالمليون ج.م', unit: 'م', rows: [
      { name: 'مقدم', cur: 1.3, prev: 1.62 }, { name: 'أقساط', cur: 0.92, prev: 1.51 },
      { name: 'دفعة تسليم', cur: 0.34, prev: 0.4 }, { name: 'حجز', cur: 0, prev: 0.2 }] },
    { title: 'حسب مسؤول المبيعات', sub: 'تحصيل عقوده بالمليون ج.م', unit: 'م', rows: [
      { name: 'عمر الشناوي', cur: 0.98, prev: 1.21, note: '2 عقد' }, { name: 'محمود البنا', cur: 0.74, prev: 0.88, note: '1 عقد' },
      { name: 'هالة عبد الرحمن', cur: 0.51, prev: 0.92, note: '1 عقد' }, { name: 'ياسمين فاروق', cur: 0.33, prev: 0.52, note: '1 عقد' }] },
  ],
};
void up;

export default function ComparePreview() {
  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">
      <PremiumPageHero
        title="مقارنة التقارير المالية"
        description="نوفمبر 2026 مقابل أكتوبر 2026 · كل المشاريع · كل أنواع الدفعات"
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/dashboard' }, { label: 'التقارير', href: '/dashboard/reports' }, { label: 'المالي' }]}
      />
      <CompareView data={data} />
    </div>
  );
}
