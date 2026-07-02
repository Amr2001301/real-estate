import Link from 'next/link';
import {
  Pencil,
  Users as UsersIcon,
  ShieldCheck,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  CalendarRange,
  Banknote,
  FileText,
  Hash,
  BarChart3,
  BookmarkCheck,
  BadgePercent,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { BrokerStatusBadge } from '@/components/badges';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const COMMISSION_MODEL_LABEL: Record<string, string> = {
  PERCENT_OF_SALE: 'نسبة مئوية من قيمة البيع',
  FIXED_PER_UNIT: 'مبلغ ثابت لكل وحدة',
  TIERED: 'شرائح متعددة',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function SideRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-[12px] font-medium text-slate-500 shrink-0">{label}</span>
      <span
        className="text-[13px] font-semibold text-slate-900 text-end truncate max-w-[55%]"
        dir={ltr ? 'ltr' : undefined}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="text-[12px] font-medium text-slate-500 shrink-0">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums text-slate-700 shrink-0">{value}</span>
    </div>
  );
}

const CMD_ROW = 'group flex items-center gap-3 px-5 py-3.5 text-sm transition-colors duration-150 hover:bg-canvas/40';
const CMD_ICON_BASE = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px]';

export default async function BrokerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<Broker>(`/brokers/${id}`));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات الوسيط: {r.error ?? 'غير موجود'}
      </div>
    );
  }

  const broker = r.data;
  const counts = broker._count ?? { brokerUsers: 0, projectAccess: 0, unitAccess: 0 };
  const commissionModel = COMMISSION_MODEL_LABEL[broker.commissionModel] ?? broker.commissionModel;

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={broker.companyName}
        description={broker.commercialName ?? undefined}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: broker.companyName },
        ]}
        meta={
          <>
            <BrokerStatusBadge status={broker.status} />
            <span className="font-mono text-xs text-slate-500" dir="ltr">{broker.code}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/brokers/${broker.id}/edit` as never}>
              <Button variant="primary" size="md" leftIcon={<Pencil className="h-4 w-4" />}>تعديل</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/users` as never}>
              <Button variant="outline" size="md" leftIcon={<UsersIcon className="h-4 w-4" />}>الموظفون</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/access` as never}>
              <Button variant="outline" size="md" leftIcon={<ShieldCheck className="h-4 w-4" />}>الصلاحيات</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/performance` as never}>
              <Button variant="outline" size="md" leftIcon={<BarChart3 className="h-4 w-4" />}>الأداء</Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/edit#status` as never}>
              <Button variant="ghost" size="md">تغيير الحالة</Button>
            </Link>
          </div>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: 'الموظفون',
            value: String(counts.brokerUsers),
            icon: <UsersIcon />,
            tone: 'brand',
          },
          {
            label: 'المشاريع المتاحة',
            value: String(counts.projectAccess),
            icon: <Briefcase />,
            tone: 'info',
          },
          {
            label: 'الوحدات المتاحة',
            value: String(counts.unitAccess),
            icon: <ShieldCheck />,
            tone: 'success',
          },
          {
            label: 'نسبة العمولة الافتراضية',
            value: `${Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%`,
            icon: <Banknote />,
            sub: commissionModel,
            tone: 'brand',
          },
        ]}
      />

      {/* ── Detail layout ─────────────────────────────────────────────── */}
      <PremiumDetailLayout
        main={
          <div className="space-y-5">

            {/* معلومات التواصل */}
            <PremiumSectionCard title="معلومات التواصل" icon={<Mail />} padded={false}>
              {/* Contact tiles */}
              <div className="grid grid-cols-2 gap-3 p-5">
                {/* Phone tile */}
                <div className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <Phone />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">رقم الجوال</p>
                    <p className="text-[13px] font-semibold text-slate-900 truncate" dir="ltr">
                      {broker.phone ?? '—'}
                    </p>
                  </div>
                </div>
                {/* Email tile */}
                <div className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <Mail />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">البريد الإلكتروني</p>
                    <p className="text-[13px] font-semibold text-slate-900 truncate" dir="ltr">
                      {broker.email ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
              {/* City + Address */}
              <div className="border-t border-hairline divide-y divide-hairline">
                <SideRow label="المدينة" value={broker.city} />
                <SideRow label="العنوان" value={broker.address} />
              </div>
            </PremiumSectionCard>

            {/* البيانات القانونية والمصرفية */}
            <PremiumSectionCard title="البيانات القانونية والمصرفية" icon={<Hash />} padded={false}>
              <div className="divide-y divide-hairline">
                <SideRow label="الرقم الضريبي" value={broker.taxId} ltr />
                <SideRow label="السجل التجاري" value={broker.commercialRegistration} ltr />
                <SideRow label="البنك" value={broker.bankName} />
                <SideRow label="اسم صاحب الحساب" value={broker.bankAccountName} />
                <SideRow label="رقم الآيبان" value={broker.bankIban} ltr />
              </div>
            </PremiumSectionCard>

            {/* ملاحظات داخلية */}
            {broker.notes && (
              <PremiumSectionCard title="ملاحظات داخلية">
                <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {broker.notes}
                </p>
              </PremiumSectionCard>
            )}

            {/* المستندات */}
            <OwnerDocumentsCard
              ownerType="BROKER"
              ownerId={broker.id}
              legacy={
                broker.contractPdfUrl
                  ? [{ label: 'اتفاقية الوسيط (PDF)', href: broker.contractPdfUrl, hint: 'حقل قديم — broker.contractPdfUrl' }]
                  : undefined
              }
            />
          </div>
        }
        side={
          <div className="space-y-5">

            {/* Command panel */}
            <PremiumCommandPanel title="إجراءات وروابط">
              <Link href={`/dashboard/brokers/${broker.id}/performance` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-brand-50 text-brand-600`}><BarChart3 /></span>
                <span className="text-[13px] font-semibold text-slate-800">الأداء</span>
              </Link>
              <Link href={`/dashboard/broker-leads?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-sky-50 text-sky-600`}><UsersIcon /></span>
                <span className="text-[13px] font-semibold text-slate-800">الفرص</span>
              </Link>
              <Link href={`/dashboard/broker-reservations?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-amber-50 text-amber-600`}><BookmarkCheck /></span>
                <span className="text-[13px] font-semibold text-slate-800">الحجوزات</span>
              </Link>
              <Link href={`/dashboard/broker-contracts?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-emerald-50 text-emerald-600`}><FileText /></span>
                <span className="text-[13px] font-semibold text-slate-800">العقود</span>
              </Link>
              <Link href={`/dashboard/broker-commissions?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-violet-50 text-violet-600`}><BadgePercent /></span>
                <span className="text-[13px] font-semibold text-slate-800">العمولات</span>
              </Link>
              <Link href={`/dashboard/broker-payouts?brokerId=${broker.id}` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-blue-50 text-blue-600`}><Wallet /></span>
                <span className="text-[13px] font-semibold text-slate-800">المدفوعات</span>
              </Link>
              <Link href={`/dashboard/brokers/${broker.id}/users` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-slate-100 text-slate-500`}><UsersIcon /></span>
                <span className="text-[13px] font-semibold text-slate-800">الموظفون</span>
              </Link>
              <Link href={`/dashboard/brokers/${broker.id}/access` as never} className={CMD_ROW}>
                <span className={`${CMD_ICON_BASE} bg-slate-100 text-slate-500`}><ShieldCheck /></span>
                <span className="text-[13px] font-semibold text-slate-800">الصلاحيات</span>
              </Link>
            </PremiumCommandPanel>

            {/* العقد */}
            <PremiumSectionCard title="العقد" icon={<CalendarRange />} padded={false}>
              <div className="divide-y divide-hairline">
                <DateRow label="بدء العقد" value={formatDate(broker.contractStartAt) ?? '—'} />
                <DateRow label="انتهاء العقد" value={formatDate(broker.contractEndAt) ?? '—'} />
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-[12px] font-medium text-slate-500 shrink-0">ملف العقد</span>
                  {broker.contractPdfUrl ? (
                    <a
                      href={broker.contractPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      فتح الملف
                    </a>
                  ) : (
                    <span className="text-[13px] text-slate-300">—</span>
                  )}
                </div>
              </div>
            </PremiumSectionCard>

          </div>
        }
      />
    </div>
  );
}
