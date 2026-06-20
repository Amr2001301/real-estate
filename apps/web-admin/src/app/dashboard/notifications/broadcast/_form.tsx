'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Users, Eye, EyeOff, Search,
} from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { Textarea } from '@/components/ui/textarea';
import {
  broadcastNotificationAction,
  previewBroadcastAction,
  type BroadcastState,
  type BroadcastPreviewResult,
} from '@/app/_actions/notifications';

const TARGET_OPTIONS = [
  { value: 'ALL_CUSTOMERS',               label: 'جميع العملاء (CUSTOMER)' },
  { value: 'ALL_BROKERS',                 label: 'جميع الوسطاء (BROKER)' },
  { value: 'ALL_SALES',                   label: 'جميع المبيعات (SALES)' },
  { value: 'ALL_MAINTENANCE_SUPERVISORS', label: 'جميع المشرفين (MAINTENANCE_SUPERVISOR)' },
  { value: 'ALL_ACTIVE',                  label: 'جميع المستخدمين النشطين' },
  { value: 'ROLE',                        label: 'دور محدد…' },
  { value: 'USER',                        label: 'مستخدم محدد (UUID)…' },
];

const ROLE_OPTIONS = [
  { value: 'ADMIN',                  label: 'ADMIN' },
  { value: 'SALES',                  label: 'SALES' },
  { value: 'SALES_MANAGER',          label: 'SALES_MANAGER' },
  { value: 'CUSTOMER',               label: 'CUSTOMER' },
  { value: 'BROKER',                 label: 'BROKER' },
  { value: 'MAINTENANCE_SUPERVISOR', label: 'MAINTENANCE_SUPERVISOR' },
  { value: 'CLIENT',                 label: 'CLIENT' },
];

// Targets that are mass-sends and require estimate + confirmation before send.
const MASS_TARGETS = new Set([
  'ALL_CUSTOMERS', 'ALL_BROKERS', 'ALL_SALES',
  'ALL_MAINTENANCE_SUPERVISORS', 'ALL_ACTIVE',
]);

export default function BroadcastForm() {
  const [state, formAction] = useActionState<BroadcastState, FormData>(
    broadcastNotificationAction,
    {},
  );
  const [target,     setTarget]     = useState('ALL_CUSTOMERS');
  const [targetRole, setTargetRole] = useState('CUSTOMER');
  const [targetUser, setTargetUser] = useState('');
  const [channel,    setChannel]    = useState('IN_APP');
  const [showPreview, setPreview]   = useState(false);
  const [confirmed,   setConfirmed] = useState(false);

  // Live preview values
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyAr,  setBodyAr]  = useState('');

  // Estimate / preview state
  const [estimate, setEstimate]       = useState<BroadcastPreviewResult | null>(null);
  const [estimating, startEstimate]   = useTransition();

  const isMass = MASS_TARGETS.has(target);

  // For mass targets: Send is enabled only after estimate fetched + confirmed.
  const sendBlocked = isMass && (estimate == null || !confirmed);

  function handleTargetChange(v: string) {
    setTarget(v);
    setEstimate(null);   // reset estimate when audience changes
    setConfirmed(false);
  }

  function handleEstimate() {
    const userId = target === 'USER' ? targetUser : undefined;
    const role   = target === 'ROLE' ? targetRole : undefined;
    startEstimate(async () => {
      const result = await previewBroadcastAction(target, userId, role);
      setEstimate(result);
      setConfirmed(false); // require re-confirm after each estimate
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {/* PUSH warning — shown whenever PUSH channel is selected */}
      {channel === 'PUSH' && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-200 text-warning-800 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-warning-600" />
          <div>
            <p className="font-semibold mb-0.5">قناة PUSH غير مفعّلة حاليًا</p>
            <p className="text-warning-700 text-xs leading-relaxed">
              إرسال PUSH يتطلب تهيئة Firebase Admin SDK (FIREBASE_PROJECT_ID، FIREBASE_CLIENT_EMAIL، FIREBASE_PRIVATE_KEY).
              الخادم سيرفض الطلب بخطأ واضح إذا لم تكن Firebase مهيّأة.
              استخدم <strong>IN_APP</strong> للإرسال الآمن حاليًا.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      {/* Success result */}
      {state.ok && (
        <div className="flex flex-col gap-2 rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            تم الإرسال بنجاح
          </div>
          <ul className="ps-7 list-disc space-y-0.5 text-success-600">
            <li>المستقبلون المستهدفون: <span className="font-bold tabular-nums">{state.recipientCount}</span></li>
            <li>تم الإنشاء: <span className="font-bold tabular-nums">{state.sent}</span></li>
            {(state.failed ?? 0) > 0 && (
              <li>فشل: <span className="font-bold tabular-nums text-warning-700">{state.failed}</span></li>
            )}
            <li className="text-2xs text-success-500 font-mono" dir="ltr">ID: {state.broadcastId}</li>
          </ul>
        </div>
      )}

      {/* Content */}
      <FormSection
        title="محتوى الإشعار"
        description="يجب إدخال كلا النسختين (العربية والإنجليزية) — سيتلقى كل مستخدم الإشعار بلغته المفضلة."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="العنوان (عربي)" name="title_ar" required>
            <Input
              id="title_ar"
              name="title_ar"
              required
              maxLength={200}
              placeholder="مثال: تحديث مهم في المنصة"
              dir="rtl"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
            />
          </Field>
          <Field label="العنوان (إنجليزي)" name="title_en" required>
            <Input
              id="title_en"
              name="title_en"
              required
              maxLength={200}
              placeholder="e.g. Important platform update"
              dir="ltr"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="نص الرسالة (عربي)" name="body_ar" required>
            <Textarea
              id="body_ar"
              name="body_ar"
              required
              maxLength={500}
              rows={3}
              placeholder="تفاصيل الإشعار بالعربية…"
              dir="rtl"
              value={bodyAr}
              onChange={(e) => setBodyAr(e.target.value)}
            />
          </Field>
          <Field label="نص الرسالة (إنجليزي)" name="body_en" required>
            <Textarea
              id="body_en"
              name="body_en"
              required
              maxLength={500}
              rows={3}
              placeholder="Notification body in English…"
              dir="ltr"
            />
          </Field>
        </div>
      </FormSection>

      {/* Audience */}
      <FormSection
        title="الجمهور المستهدف"
        description="حدد من يستقبل هذا الإشعار. للجماهير الواسعة: اضغط «تقدير المستقبلين» أولًا."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="نوع الجمهور" name="target" required>
            <Select
              id="target"
              name="target"
              required
              value={target}
              onChange={(e) => handleTargetChange(e.target.value)}
            >
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>

          {target === 'ROLE' && (
            <Field label="الدور" name="targetRole" required>
              <Select
                id="targetRole"
                name="targetRole"
                required
                value={targetRole}
                onChange={(e) => { setTargetRole(e.target.value); setEstimate(null); setConfirmed(false); }}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          )}

          {target === 'USER' && (
            <Field label="معرف المستخدم (UUID)" name="targetUserId" required>
              <Input
                id="targetUserId"
                name="targetUserId"
                required
                dir="ltr"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                value={targetUser}
                onChange={(e) => { setTargetUser(e.target.value); setEstimate(null); setConfirmed(false); }}
              />
            </Field>
          )}
        </div>

        {/* Estimate section */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEstimate}
              disabled={estimating}
            >
              <Search className="h-3.5 w-3.5 me-1.5" />
              {estimating ? 'جارٍ التقدير…' : 'تقدير عدد المستقبلين'}
            </Button>

            {estimate && !estimate.error && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-sm text-brand-700 font-semibold">
                <Users className="h-3.5 w-3.5" />
                {estimate.recipientCount} مستقبل
              </span>
            )}

            {estimate?.error && (
              <span className="text-sm text-danger-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {estimate.error}
              </span>
            )}
          </div>

          {/* Confirmation checkbox — only for mass targets, only after estimate */}
          {isMass && estimate != null && !estimate.error && (
            <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600 cursor-pointer"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="text-warning-800 leading-snug">
                أتأكد من أنني أريد إرسال هذا الإشعار إلى{' '}
                <strong>{estimate.recipientCount}</strong> مستخدم.
                هذا الإجراء لا يمكن التراجع عنه.
              </span>
            </label>
          )}

          {/* Hint when mass target but no estimate yet */}
          {isMass && estimate == null && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-warning-500 shrink-0" />
              هذا الإرسال الجماعي يتطلب تقدير عدد المستقبلين والتأكيد قبل الإرسال.
            </p>
          )}
        </div>
      </FormSection>

      {/* Channel */}
      <FormSection
        title="قناة الإرسال"
        description="IN_APP يُنشئ الإشعار في القائمة فوراً. PUSH يرسل دفعاً للأجهزة المحمولة — يتطلب تهيئة Firebase."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="القناة" name="channel" required>
            <Select
              id="channel"
              name="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="IN_APP">IN_APP — داخل التطبيق</option>
              <option value="PUSH">PUSH — دفع للجوال (يتطلب Firebase)</option>
            </Select>
          </Field>
        </div>
      </FormSection>

      {/* Optional deep link */}
      <FormSection
        title="رابط عميق (اختياري)"
        description="إذا كانت الرسالة تتعلق بكيان محدد، أضف نوعه ومعرفه لتمكين التنقل المباشر."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="نوع الكيان" name="entityType" hint="مثال: maintenance, reservation, unit">
            <Input
              id="entityType"
              name="entityType"
              maxLength={60}
              placeholder="maintenance"
              dir="ltr"
            />
          </Field>
          <Field label="معرف الكيان (UUID)" name="entityId">
            <Input
              id="entityId"
              name="entityId"
              maxLength={36}
              dir="ltr"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </Field>
        </div>
      </FormSection>

      {/* Live preview */}
      <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            معاينة الإشعار
          </span>
          <span className="text-slate-400 text-xs">(محاكاة المظهر في القائمة)</span>
        </button>
        {showPreview && (
          <div className="border-t border-hairline px-4 py-4">
            <div className="flex items-start gap-3 rounded-xl border border-hairline bg-brand-50/30 px-4 py-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {titleAr || <span className="text-slate-400 italic">العنوان بالعربية…</span>}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap" dir="ltr">الآن</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-snug">
                  {bodyAr || <span className="italic text-slate-300">نص الرسالة بالعربية…</span>}
                </p>
              </div>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
            </div>
            <p className="mt-2 text-2xs text-slate-400 text-center">
              هذه محاكاة — المظهر الفعلي قد يختلف بحسب اللغة المفضلة للمستخدم
            </p>
          </div>
        )}
      </div>

      <FormFooter
        sticky
        primary={
          <SubmitButton disabled={sendBlocked}>
            إرسال الإشعار
          </SubmitButton>
        }
        helper={
          sendBlocked
            ? 'قدِّر عدد المستقبلين وأكّد قبل الإرسال الجماعي.'
            : 'لا يمكن التراجع عن الإرسال. تأكد من المحتوى والجمهور قبل الإرسال.'
        }
      />
    </form>
  );
}
