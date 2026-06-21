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

const CMD_LINK = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 hover:bg-white/[0.07] hover:text-white/95 transition-colors';
const CMD_ICON = 'h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/[0.08] text-brand-300 shrink-0 [&_svg]:h-4 [&_svg]:w-4';

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

      <PremiumMetricStrip
        metrics={[
          {
            label: 'الموظفون',
            value: counts.brokerUsers,
            icon: <UsersIcon className="h-4 w-4" />,
            tone: 'brand',
          },
          {
            label: 'المشاريع المتاحة',
            value: counts.projectAccess,
            icon: <Briefcase className="h-4 w-4" />,
            tone: 'info',
          },
          {
            label: 'الوحدات المتاحة',
            value: counts.unitAccess,
            icon: <ShieldCheck className="h-4 w-4" />,
            tone: 'success',
          },
          {
            label: 'نسبة العمولة الافتراضية',
            value: `${Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%`,
            icon: <Banknote className="h-4 w-4" />,
            sub: commissionModel,
            tone: 'brand',
          },
        ]}
      />

      <PremiumDetailLayout
        main={
          <div className="space-y-5">
            <PremiumSectionCard title="معلومات التواصل" icon={<Mail className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
                <InfoRow icon={<Mail />} label="البريد الإلكتروني" value={broker.email} dir="ltr" />
                <InfoRow icon={<Phone />} label="رقم الجوال" value={broker.phone} dir="ltr" />
                <InfoRow icon={<MapPin />} label="المدينة" value={broker.city} />
                <InfoRow icon={<MapPin />} label="العنوان" value={broker.address} />
              </div>
            </PremiumSectionCard>

            <PremiumSectionCard title="البيانات القانونية والمصرفية" icon={<Hash className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
                <InfoRow icon={<Hash />} label="الرقم الضريبي" value={broker.taxId} dir="ltr" />
                <InfoRow icon={<Hash />} label="السجل التجاري" value={broker.commercialRegistration} dir="ltr" />
                <InfoRow icon={<Banknote />} label="البنك" value={broker.bankName} />
                <InfoRow icon={<Banknote />} label="اسم صاحب الحساب" value={broker.bankAccountName} />
                <InfoRow icon={<Banknote />} label="رقم الآيبان" value={broker.bankIban} dir="ltr" />
              </div>
            </PremiumSectionCard>

            {broker.notes && (
              <PremiumSectionCard title="ملاحظات داخلية">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {broker.notes}
                </p>
              </PremiumSectionCard>
            )}

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
            <PremiumCommandPanel title="إجراءات وروابط">
              <Link href={`/dashboard/brokers/${broker.id}/performance` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><BarChart3 /></span>
                الأداء
              </Link>
              <Link href={`/dashboard/broker-leads?brokerId=${broker.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><UsersIcon /></span>
                الفرص
              </Link>
              <Link href={`/dashboard/broker-reservations?brokerId=${broker.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><BookmarkCheck /></span>
                الحجوزات
              </Link>
              <Link href={`/dashboard/broker-contracts?brokerId=${broker.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><FileText /></span>
                العقود
              </Link>
              <Link href={`/dashboard/broker-commissions?brokerId=${broker.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><BadgePercent /></span>
                العمولات
              </Link>
              <Link href={`/dashboard/broker-payouts?brokerId=${broker.id}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><Wallet /></span>
                المدفوعات
              </Link>
              <Link href={`/dashboard/brokers/${broker.id}/users` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><UsersIcon /></span>
                الموظفون
              </Link>
              <Link href={`/dashboard/brokers/${broker.id}/access` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><ShieldCheck /></span>
                الصلاحيات
              </Link>
            </PremiumCommandPanel>

            <PremiumSectionCard title="العقد" icon={<CalendarRange className="h-4 w-4" />}>
              <div className="flex flex-col gap-1">
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
              </div>
            </PremiumSectionCard>
          </div>
        }
      />
    </div>
  );
}
