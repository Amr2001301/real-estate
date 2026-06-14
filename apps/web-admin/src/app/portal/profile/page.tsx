import {
  Mail,
  Phone,
  MapPin,
  CalendarRange,
  Banknote,
  FileText,
  Hash,
  ShieldCheck,
  Star,
  UserCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalMe } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { BrokerStatusBadge, BrokerUserStatusBadge } from '@/components/badges';

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

export default async function PortalProfilePage() {
  const r = await safe(api.get<PortalMe>('/portal/profile'));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات الملف الشخصي: {r.error ?? 'غير متاحة'}
      </div>
    );
  }

  const me = r.data;
  const commissionModel =
    COMMISSION_MODEL_LABEL[me.broker.commissionModel] ?? me.broker.commissionModel;

  return (
    <div className="space-y-5">
      <PageHeader
        title="الملف الشخصي"
        description="بياناتك ومعلومات شركة الوساطة وصلاحياتك في النظام."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الملف الشخصي' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-brand-600" />
            بياناتك
          </h2>
          <div className="flex items-center gap-2 mb-2">
            <BrokerUserStatusBadge status={me.brokerUser.status} />
            {me.brokerUser.isPrimaryContact && (
              <span className="inline-flex items-center gap-1 text-2xs text-amber-700">
                <Star className="h-3 w-3 fill-current" />
                جهة اتصال رئيسية
              </span>
            )}
          </div>
          <InfoRow icon={<UserCircle />} label="الاسم" value={me.user.fullName} />
          <InfoRow icon={<Mail />} label="البريد الإلكتروني" value={me.user.email} dir="ltr" />
          <InfoRow icon={<Phone />} label="رقم الجوال" value={me.user.phone} dir="ltr" />
          <InfoRow
            icon={<ShieldCheck />}
            label="الوظيفة"
            value={me.brokerUser.jobTitle ?? '—'}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الانضمام"
            value={formatDate(me.brokerUser.joinedAt ?? me.brokerUser.invitedAt)}
          />
          <InfoRow
            icon={<CalendarRange />}
            label="آخر دخول"
            value={formatDate(me.user.lastLoginAt)}
          />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            شركة الوساطة
          </h2>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="font-bold text-slate-900">{me.broker.companyName}</span>
            <BrokerStatusBadge status={me.broker.status} />
            <span className="font-mono text-xs text-slate-500" dir="ltr">
              {me.broker.code}
            </span>
          </div>
          {me.broker.commercialName && (
            <p className="text-sm text-slate-500 mb-3">{me.broker.commercialName}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
            <InfoRow icon={<Mail />} label="البريد الإلكتروني" value={me.broker.email} dir="ltr" />
            <InfoRow icon={<Phone />} label="رقم الجوال" value={me.broker.phone} dir="ltr" />
            <InfoRow icon={<MapPin />} label="المدينة" value={me.broker.city} />
            <InfoRow icon={<MapPin />} label="العنوان" value={me.broker.address} />
            <InfoRow
              icon={<Banknote />}
              label="النسبة الافتراضية"
              value={`${Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}%`}
            />
            <InfoRow icon={<Hash />} label="نموذج العمولة" value={commissionModel} />
            <InfoRow
              icon={<CalendarRange />}
              label="بدء العقد"
              value={formatDate(me.broker.contractStartAt)}
            />
            <InfoRow
              icon={<CalendarRange />}
              label="انتهاء العقد"
              value={formatDate(me.broker.contractEndAt)}
            />
            <InfoRow
              icon={<FileText />}
              label="ملف العقد"
              value={
                me.broker.contractPdfUrl ? (
                  <a
                    href={me.broker.contractPdfUrl}
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
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">صلاحياتك</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <li className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">جهة اتصال رئيسية</p>
            <p className="font-semibold mt-1">
              {me.permissions.isPrimaryContact ? 'نعم' : 'لا'}
            </p>
          </li>
          <li className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">إدارة الموظفين</p>
            <p className="font-semibold mt-1">
              {me.permissions.canManageBrokerUsers ? 'مسموح' : 'غير مسموح'}
            </p>
          </li>
          <li className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">عرض العمولات</p>
            <p className="font-semibold mt-1">
              {me.permissions.canViewCommissions ? 'مسموح' : 'غير مسموح'}
            </p>
          </li>
        </ul>
        <p className="mt-3 text-2xs text-slate-500">
          لا يمكنك تعديل بياناتك من البوابة. لتحديث أي معلومة، يرجى التواصل مع
          مدير شركة الوساطة أو إدارة المنصة.
        </p>
      </Card>
    </div>
  );
}
