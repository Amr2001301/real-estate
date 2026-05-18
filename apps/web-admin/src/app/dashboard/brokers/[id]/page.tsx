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
  ChevronLeft,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { BrokerStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const COMMISSION_MODEL_LABEL: Record<string, string> = {
  PERCENT_OF_SALE: 'نسبة مئوية من قيمة البيع',
  FIXED_PER_UNIT: 'مبلغ ثابت لكل وحدة',
  TIERED: 'شرائح متعددة',
};

function InfoRow({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-800 mt-0.5" dir={dir}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

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
      <PageHeader
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
            <span className="font-mono text-xs text-slate-500" dir="ltr">
              {broker.code}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/brokers/${broker.id}/edit` as never}>
              <Button variant="primary" size="md" leftIcon={<Pencil className="h-4 w-4" />}>
                تعديل
              </Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/users` as never}>
              <Button variant="outline" size="md" leftIcon={<UsersIcon className="h-4 w-4" />}>
                الموظفون
              </Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/access` as never}>
              <Button variant="outline" size="md" leftIcon={<ShieldCheck className="h-4 w-4" />}>
                الصلاحيات
              </Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/performance` as never}>
              <Button variant="outline" size="md" leftIcon={<BarChart3 className="h-4 w-4" />}>
                الأداء
              </Button>
            </Link>
            <Link href={`/dashboard/brokers/${broker.id}/edit#status` as never}>
              <Button variant="ghost" size="md">
                تغيير الحالة
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard
          label="الموظفون"
          value={counts.brokerUsers}
          icon={<UsersIcon />}
          tone="brand"
        />
        <PageKpiCard
          label="المشاريع المتاحة"
          value={counts.projectAccess}
          icon={<Briefcase />}
          tone="info"
        />
        <PageKpiCard
          label="الوحدات المتاحة"
          value={counts.unitAccess}
          icon={<ShieldCheck />}
          tone="accent"
        />
        <PageKpiCard
          label="نسبة العمولة الافتراضية"
          value={`${Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%`}
          icon={<Banknote />}
          tone="success"
          sub={commissionModel}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">معلومات التواصل</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
            <InfoRow icon={<Mail />} label="البريد الإلكتروني" value={broker.email} dir="ltr" />
            <InfoRow icon={<Phone />} label="رقم الجوال" value={broker.phone} dir="ltr" />
            <InfoRow icon={<MapPin />} label="المدينة" value={broker.city} />
            <InfoRow icon={<MapPin />} label="العنوان" value={broker.address} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">العقد</h2>
          <InfoRow
            icon={<CalendarRange />}
            label="بدء العقد"
            value={formatDate(broker.contractStartAt)}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="انتهاء العقد"
            value={formatDate(broker.contractEndAt)}
          />
          <InfoRow
            icon={<FileText />}
            label="ملف العقد"
            value={
              broker.contractPdfUrl ? (
                <a
                  href={broker.contractPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 hover:text-brand-800 underline"
                  dir="ltr"
                >
                  فتح الملف
                </a>
              ) : (
                '—'
              )
            }
          />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">البيانات القانونية والمصرفية</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
          <InfoRow icon={<Hash />} label="الرقم الضريبي" value={broker.taxId} dir="ltr" />
          <InfoRow icon={<Hash />} label="السجل التجاري" value={broker.commercialRegistration} dir="ltr" />
          <InfoRow icon={<Banknote />} label="البنك" value={broker.bankName} />
          <InfoRow icon={<Banknote />} label="اسم صاحب الحساب" value={broker.bankAccountName} />
          <InfoRow icon={<Banknote />} label="رقم الآيبان" value={broker.bankIban} dir="ltr" />
        </div>
      </Card>

      {broker.notes && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">ملاحظات داخلية</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {broker.notes}
          </p>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">روابط سريعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { href: `/dashboard/brokers/${broker.id}/performance`, label: 'الأداء', icon: BarChart3 },
            { href: `/dashboard/broker-leads?brokerId=${broker.id}`, label: 'الفرص', icon: UsersIcon },
            { href: `/dashboard/broker-reservations?brokerId=${broker.id}`, label: 'الحجوزات', icon: BookmarkCheck },
            { href: `/dashboard/broker-contracts?brokerId=${broker.id}`, label: 'العقود', icon: FileText },
            { href: `/dashboard/broker-commissions?brokerId=${broker.id}`, label: 'العمولات', icon: BadgePercent },
            { href: `/dashboard/broker-payouts?brokerId=${broker.id}`, label: 'المدفوعات', icon: Wallet },
            { href: `/dashboard/brokers/${broker.id}/users`, label: 'الموظفون', icon: UsersIcon },
            { href: `/dashboard/brokers/${broker.id}/access`, label: 'الصلاحيات', icon: ShieldCheck },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href as never}
              className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 hover:bg-surface-muted hover:border-slate-300 transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                <q.icon className="h-4 w-4 text-slate-500" />
                {q.label}
              </span>
              <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
