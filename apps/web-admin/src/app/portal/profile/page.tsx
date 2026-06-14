import type { ReactNode } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  CalendarRange,
  FileText,
  ShieldCheck,
  Star,
  Building2,
  AlertTriangle,
  AlertCircle,
  UserCircle,
  ExternalLink,
  CalendarDays,
  BadgePercent,
  Users,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalMe } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { CodeText } from '@/components/ui/code-text';
import { BrokerStatusBadge, BrokerUserStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const COMMISSION_MODEL_LABEL: Record<string, string> = {
  PERCENT_OF_SALE: 'نسبة مئوية من قيمة البيع',
  FIXED_PER_UNIT:  'مبلغ ثابت لكل وحدة',
  TIERED:          'شرائح متعددة',
};

const AVATAR_PALETTE = [
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-slate-100 text-slate-700',
  'bg-brand-100 text-brand-800',   // index 4 → warm gold (covers "NB" char-sum)
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_PALETTE[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]!;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function contractDaysLeft(endAt: string | null | undefined): number | null {
  if (!endAt) return null;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

/** Muted empty-state placeholder for missing values */
function Empty({ text = 'غير متوفر' }: { text?: string }) {
  return <span className="text-slate-300 text-xs font-normal">{text}</span>;
}

/** Label + value cell used in the identity grid. Value paragraph stays in RTL
 *  so label and value share the same edge. Use dir="ltr" on inner <a>/<span>
 *  for LTR content (email, phone) instead. */
function IdentityCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-2xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
        <span className="[&_svg]:h-3 [&_svg]:w-3 text-slate-300 shrink-0">{icon}</span>
        {label}
      </p>
      <p className="text-sm font-medium text-slate-800 leading-snug">
        {value}
      </p>
    </div>
  );
}

/** Compact info row used in company card */
function CompanyRow({
  icon,
  label,
  value,
  dir,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  dir?: 'ltr';
}) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-hairline last:border-0">
      <span className="mt-0.5 text-slate-300 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-4">
        <p className="text-2xs text-slate-400 shrink-0">{label}</p>
        <p className="text-sm text-slate-800 font-medium text-end leading-snug" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  );
}

/** Compact permission row */
function PermissionRow({
  icon,
  label,
  allowed,
}: {
  icon: ReactNode;
  label: string;
  allowed: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-hairline last:border-0">
      <span
        className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5',
          allowed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300',
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
      <span
        className={cn(
          'text-2xs font-semibold rounded-full px-2 py-0.5',
          allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400',
        )}
      >
        {allowed ? 'مسموح' : 'محظور'}
      </span>
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

  const me              = r.data;
  const commissionModel = COMMISSION_MODEL_LABEL[me.broker.commissionModel] ?? me.broker.commissionModel;
  const daysLeft        = contractDaysLeft(me.broker.contractEndAt);
  const contractExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  const contractExpired      = daysLeft !== null && daysLeft < 0;
  const hasContractDates     = me.broker.contractStartAt || me.broker.contractEndAt;
  const userName             = me.user.fullName ?? me.user.email ?? '';

  return (
    <div className="space-y-4">

      {/* ── Contract alerts ─────────────────────────────────────────── */}
      {contractExpired && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">انتهى عقد الوساطة</p>
            <p className="text-2xs mt-0.5 text-danger-600">تواصل مع إدارة المنصة لتجديد العقد والحفاظ على وصولك الكامل.</p>
          </div>
        </div>
      )}
      {contractExpiringSoon && !contractExpired && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">عقد الوساطة ينتهي خلال {daysLeft} يوم</p>
            <p className="text-2xs mt-0.5 text-amber-700">تواصل مع إدارة المنصة لتجديد العقد في أقرب وقت.</p>
          </div>
        </div>
      )}

      {/* ── Identity hero ────────────────────────────────────────────── */}
      <Card
        className="overflow-hidden"
        style={{ borderTopWidth: 3, borderTopColor: '#C8A24B' }}
      >
        <div className="p-5 sm:p-6">
          {/* Avatar + name row */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div
              className={cn(
                'h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center shrink-0',
                'text-xl sm:text-2xl font-black',
                avatarColor(userName),
              )}
            >
              {userName ? initials(userName) : <UserCircle className="h-8 w-8" />}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                  {me.user.fullName ?? <Empty text="بدون اسم" />}
                </h1>
                <BrokerUserStatusBadge status={me.brokerUser.status} />
                {me.brokerUser.isPrimaryContact && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                    <Star className="h-3 w-3 fill-current" />
                    جهة اتصال رئيسية
                  </span>
                )}
              </div>
              {me.brokerUser.jobTitle && (
                <p className="text-sm text-slate-500 mb-0.5">{me.brokerUser.jobTitle}</p>
              )}
              <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="font-medium text-slate-600">{me.broker.companyName}</span>
                <span className="text-slate-200">·</span>
                <CodeText className="text-2xs text-slate-400">{me.broker.code}</CodeText>
              </p>
            </div>
          </div>

          {/* Info strip — user account fields only */}
          <div className="mt-4 pt-4 border-t border-hairline">
            <p className="text-2xs font-semibold uppercase tracking-wide text-slate-300 mb-3">بيانات حساب المستخدم</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              <IdentityCell
                icon={<Mail />}
                label="البريد الإلكتروني للحساب"
                value={me.user.email ? (
                  <a href={`mailto:${me.user.email}`} className="hover:text-brand-700 transition-colors" dir="ltr">
                    {me.user.email}
                  </a>
                ) : <Empty />}
              />
              <IdentityCell
                icon={<Phone />}
                label="رقم جوال المستخدم"
                value={me.user.phone
                  ? <a href={`tel:${me.user.phone}`} className="hover:text-brand-700 transition-colors" dir="ltr">{me.user.phone}</a>
                  : <Empty text="غير محدد" />
                }
              />
              <IdentityCell
                icon={<CalendarRange />}
                label="تاريخ الانضمام"
                value={me.brokerUser.joinedAt ?? me.brokerUser.invitedAt
                  ? formatDate(me.brokerUser.joinedAt ?? me.brokerUser.invitedAt)
                  : <Empty />
                }
              />
              <IdentityCell
                icon={<CalendarDays />}
                label="آخر دخول"
                value={me.user.lastLoginAt
                  ? formatDate(me.user.lastLoginAt)
                  : <span className="text-slate-400 text-xs font-normal">لم يسجل دخولاً بعد</span>
                }
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Bottom grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Company card */}
        <Card className="lg:col-span-2 overflow-hidden">
          {/* Company header */}
          <div className="flex items-start gap-3 p-5 pb-4 border-b border-hairline">
            {me.broker.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={me.broker.logoUrl}
                alt={me.broker.companyName}
                className="h-11 w-11 rounded-xl object-contain bg-slate-50 border border-hairline shrink-0"
              />
            ) : (
              <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h2 className="text-base font-bold text-slate-900">{me.broker.companyName}</h2>
                <BrokerStatusBadge status={me.broker.status} />
              </div>
              <p className="flex items-center gap-1.5 text-2xs text-slate-400">
                <CodeText className="text-2xs font-medium text-slate-500">{me.broker.code}</CodeText>
                {me.broker.commercialName && (
                  <>
                    <span className="text-slate-200">·</span>
                    <span>{me.broker.commercialName}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-0">
            {/* Contact + location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <CompanyRow icon={<Mail />}   label="البريد الإلكتروني للشركة" dir="ltr"
                value={me.broker.email
                  ? <a href={`mailto:${me.broker.email}`} className="hover:text-brand-700 transition-colors">{me.broker.email}</a>
                  : <Empty />}
              />
              <CompanyRow icon={<Phone />}  label="هاتف الشركة" dir="ltr"
                value={me.broker.phone
                  ? <a href={`tel:${me.broker.phone}`} className="hover:text-brand-700 transition-colors">{me.broker.phone}</a>
                  : <Empty />}
              />
              <CompanyRow icon={<MapPin />} label="المدينة"
                value={me.broker.city ?? <Empty text="غير محددة" />}
              />
              <CompanyRow icon={<MapPin />} label="العنوان"
                value={me.broker.address ?? <Empty text="غير محدد" />}
              />
            </div>

            {/* Commission highlight */}
            <div className="mt-4 pt-4 border-t border-hairline grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-brand-50/50 border border-brand-100/60 px-4 py-3">
                <p className="text-2xs font-semibold text-brand-600/80 mb-1.5">نموذج العمولة</p>
                <p className="text-sm font-bold text-brand-800 leading-snug">{commissionModel}</p>
              </div>
              <div className="rounded-xl bg-brand-50/50 border border-brand-100/60 px-4 py-3">
                <p className="text-2xs font-semibold text-brand-600/80 mb-1.5">النسبة الافتراضية</p>
                <p className="text-2xl font-black text-brand-700 tabular-nums leading-none">
                  {Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}
                  <span className="text-base font-bold ms-0.5">%</span>
                </p>
              </div>
            </div>

            {/* Contract dates */}
            <div className="mt-4 pt-4 border-t border-hairline">
              <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400 mb-3">مدة الاتفاقية</p>
              {hasContractDates ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xs text-slate-400 mb-1">بداية العقد</p>
                    <p className="text-sm font-medium text-slate-800">
                      {me.broker.contractStartAt ? formatDate(me.broker.contractStartAt) : <Empty />}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs text-slate-400 mb-1">نهاية العقد</p>
                    <p className={cn(
                      'text-sm font-medium flex items-center gap-2 flex-wrap',
                      contractExpired ? 'text-red-600' : contractExpiringSoon ? 'text-amber-700' : 'text-slate-800',
                    )}>
                      {me.broker.contractEndAt
                        ? formatDate(me.broker.contractEndAt)
                        : <Empty />
                      }
                      {contractExpired && (
                        <span className="text-2xs font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5">منتهي</span>
                      )}
                      {contractExpiringSoon && !contractExpired && (
                        <span className="text-2xs font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{daysLeft} يوم متبقٍ</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-300">
                  <CalendarRange className="h-4 w-4 shrink-0" />
                  <p className="text-sm">تواريخ العقد غير مُحددة — تواصل مع إدارة المنصة</p>
                </div>
              )}
              {me.broker.contractPdfUrl && (
                <a
                  href={me.broker.contractPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-semibold"
                  dir="ltr"
                >
                  <FileText className="h-3.5 w-3.5" />
                  فتح ملف العقد
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}
            </div>
          </div>
        </Card>

        {/* Permissions card */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-brand-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">صلاحياتك</h2>
          </div>
          <p className="text-2xs text-slate-400 mb-4 leading-relaxed">
            الصلاحيات الممنوحة لحسابك داخل بوابة الوسيط.
          </p>

          <ul>
            <PermissionRow
              icon={<Star />}
              label="جهة اتصال رئيسية"
              allowed={me.permissions.isPrimaryContact}
            />
            <PermissionRow
              icon={<Users />}
              label="إدارة أعضاء الفريق"
              allowed={me.permissions.canManageBrokerUsers}
            />
            <PermissionRow
              icon={<BadgePercent />}
              label="عرض العمولات"
              allowed={me.permissions.canViewCommissions}
            />
          </ul>

          <div className="mt-4 pt-4 border-t border-hairline flex items-start gap-2 text-2xs text-slate-400 leading-relaxed">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-300" />
            <p>لتعديل أي بيانات أو صلاحيات، تواصل مع مدير الحساب أو إدارة المنصة.</p>
          </div>
        </Card>

      </div>
    </div>
  );
}
