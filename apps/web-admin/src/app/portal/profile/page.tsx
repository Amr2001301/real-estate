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
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  UserCircle,
  ExternalLink,
  CalendarClock,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalMe } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { BrokerStatusBadge, BrokerUserStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const COMMISSION_MODEL_LABEL: Record<string, string> = {
  PERCENT_OF_SALE: 'نسبة مئوية من قيمة البيع',
  FIXED_PER_UNIT: 'مبلغ ثابت لكل وحدة',
  TIERED:         'شرائح متعددة',
};

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-800',
  'bg-violet-100 text-violet-800',
  'bg-emerald-100 text-emerald-800',
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
];

function avatarColor(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function contractDaysLeft(endAt: string | null | undefined): number | null {
  if (!endAt) return null;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function InfoCell({
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
    <div className="flex items-start gap-3 py-2.5 border-b border-hairline last:border-0">
      <span className="mt-0.5 text-slate-400 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-2xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm text-slate-800 font-medium break-all" dir={dir}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

function PermissionCell({
  label,
  allowed,
}: {
  label: string;
  allowed: boolean;
}) {
  return (
    <li
      className={cn(
        'rounded-xl border px-4 py-3.5 flex items-center gap-3',
        allowed
          ? 'border-emerald-100 bg-emerald-50/40'
          : 'border-slate-100 bg-slate-50/40',
      )}
    >
      <span
        className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
          allowed
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-400',
        )}
      >
        {allowed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className={cn('text-2xs mt-0.5', allowed ? 'text-emerald-700' : 'text-slate-400')}>
          {allowed ? 'مسموح' : 'غير مسموح'}
        </p>
      </div>
    </li>
  );
}

export default async function PortalProfilePage() {
  const r = await safe(api.get<PortalMe>('/portal/profile'));

  if (r.error || !r.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        تعذر تحميل بيانات الملف الشخصي: {r.error ?? 'غير متاحة'}
      </div>
    );
  }

  const me             = r.data;
  const commissionModel = COMMISSION_MODEL_LABEL[me.broker.commissionModel] ?? me.broker.commissionModel;
  const daysLeft        = contractDaysLeft(me.broker.contractEndAt);
  const contractExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  const contractExpired      = daysLeft !== null && daysLeft < 0;
  const userName             = me.user.fullName ?? me.user.email ?? '';

  return (
    <div className="space-y-5">

      {/* ── Contract expiry alert ────────────────────────────────────────────── */}
      {contractExpired && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">انتهى عقد الوساطة</p>
            <p className="text-2xs mt-1 text-danger-600">
              تواصل مع إدارة المنصة لتجديد عقد الوساطة والحفاظ على وصولك الكامل.
            </p>
          </div>
        </div>
      )}
      {contractExpiringSoon && !contractExpired && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">عقد الوساطة ينتهي خلال {daysLeft} يوم</p>
            <p className="text-2xs mt-1 text-amber-700">
              تواصل مع إدارة المنصة لتجديد العقد في أقرب وقت.
            </p>
          </div>
        </div>
      )}

      {/* ── Identity card ───────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-brand-900 to-brand-800" />
        <div className="px-6 pb-6">
          <div className="-mt-8 flex items-end gap-5">
            <span
              className={cn(
                'h-16 w-16 rounded-2xl border-4 border-white flex items-center justify-center font-black text-xl shrink-0',
                avatarColor(userName),
              )}
            >
              {userName ? initials(userName) : <UserCircle className="h-8 w-8" />}
            </span>
            <div className="mb-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900 truncate">{me.user.fullName ?? '—'}</h1>
                <BrokerUserStatusBadge status={me.brokerUser.status} />
                {me.brokerUser.isPrimaryContact && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                    <Star className="h-3 w-3 fill-current" />
                    جهة اتصال رئيسية
                  </span>
                )}
              </div>
              {me.brokerUser.jobTitle && (
                <p className="text-sm text-slate-500">{me.brokerUser.jobTitle}</p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-hairline">
            <div className="sm:pe-6">
              <InfoCell icon={<Mail />}    label="البريد الإلكتروني" value={me.user.email}  dir="ltr" />
            </div>
            <div className="sm:px-6">
              <InfoCell icon={<Phone />}   label="رقم الجوال"       value={me.user.phone}  dir="ltr" />
            </div>
            <div className="sm:ps-6">
              <InfoCell
                icon={<CalendarClock />}
                label="آخر دخول"
                value={me.user.lastLoginAt ? formatDate(me.user.lastLoginAt) : 'لم يسجل دخولاً بعد'}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Bottom grid: broker + permissions ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Broker company card */}
        <Card className="p-5 lg:col-span-2 space-y-1">
          <div className="flex items-start gap-3 mb-4">
            <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{me.broker.companyName}</h2>
                <BrokerStatusBadge status={me.broker.status} />
                <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md" dir="ltr">
                  {me.broker.code}
                </span>
              </div>
              {me.broker.commercialName && (
                <p className="text-xs text-slate-500 mt-0.5">{me.broker.commercialName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <InfoCell icon={<Mail />}     label="البريد الإلكتروني للشركة" value={me.broker.email}   dir="ltr" />
            <InfoCell icon={<Phone />}    label="هاتف الشركة"              value={me.broker.phone}   dir="ltr" />
            <InfoCell icon={<MapPin />}   label="المدينة"                  value={me.broker.city} />
            <InfoCell icon={<MapPin />}   label="العنوان"                  value={me.broker.address} />
            <InfoCell
              icon={<Banknote />}
              label="نسبة العمولة الافتراضية"
              value={`${Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}%`}
            />
            <InfoCell icon={<Hash />} label="نموذج العمولة" value={commissionModel} />
            <InfoCell
              icon={<CalendarRange />}
              label="بداية العقد"
              value={formatDate(me.broker.contractStartAt)}
            />
            <InfoCell
              icon={<CalendarRange />}
              label="نهاية العقد"
              value={
                <span
                  className={cn(
                    contractExpired ? 'text-danger-700 font-bold' :
                    contractExpiringSoon ? 'text-amber-700 font-bold' : '',
                  )}
                >
                  {formatDate(me.broker.contractEndAt) ?? '—'}
                  {contractExpired && ' (منتهي)'}
                  {contractExpiringSoon && !contractExpired && ` (${daysLeft} يوم متبقٍ)`}
                </span>
              }
            />
            {me.broker.contractPdfUrl && (
              <InfoCell
                icon={<FileText />}
                label="ملف العقد"
                value={
                  <a
                    href={me.broker.contractPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800 font-semibold text-xs"
                    dir="ltr"
                  >
                    فتح الملف
                    <ExternalLink className="h-3 w-3" />
                  </a>
                }
              />
            )}
          </div>
        </Card>

        {/* Permissions card */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">صلاحياتك</h2>
          </div>
          <ul className="space-y-2">
            <PermissionCell label="جهة اتصال رئيسية"  allowed={me.permissions.isPrimaryContact}    />
            <PermissionCell label="إدارة أعضاء الفريق" allowed={me.permissions.canManageBrokerUsers} />
            <PermissionCell label="عرض العمولات"       allowed={me.permissions.canViewCommissions}   />
          </ul>
          <p className="mt-4 text-2xs text-slate-400 leading-relaxed">
            لتعديل أي بيانات أو صلاحيات، تواصل مع مدير الحساب أو إدارة المنصة.
          </p>
        </Card>

      </div>
    </div>
  );
}
