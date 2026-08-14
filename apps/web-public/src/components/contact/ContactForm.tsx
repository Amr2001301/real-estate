'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Send, Building2, Home as HomeIcon, Clock3, CalendarClock } from 'lucide-react';
import { safePost, type ApiResult } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { routes } from '@/lib/routes';
import { captureUtm, type UtmAttribution } from '@/lib/utm';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Textarea, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';
import { IconCircle } from '@/components/ui/IconCircle';

export interface ContactContext {
  projectId?: string;
  unitId?: string;
  projectName?: string;
  unitLabel?: string;
}

/**
 * Best-effort prefill from the signed-in user's profile. Each field is
 * optional — when a field is missing the input stays empty so the user can
 * type in the missing piece. Guest renders pass `undefined` (or omit) and
 * the form starts blank, as before.
 */
export interface ContactPrefill {
  fullName?: string;
  phone?: string;
  email?: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const PHONE_RE = /^[+\d][\d\s-]{6,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUCCESS = 'تم إرسال طلبك بنجاح. سيتواصل معك أحد مستشارينا قريبًا.';

/** Map an API failure to a calm, specific Arabic message — never raw detail. */
function mapError(status: number, hasContext: boolean): string {
  if (status === 0) return 'تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.';
  if ((status === 400 || status === 404) && hasContext)
    return 'تعذر إرسال الطلب لهذا العقار حاليًا. اختر عقارًا آخر أو تواصل معنا مباشرة.';
  if (status === 400) return 'برجاء مراجعة البيانات المطلوبة.';
  return 'تعذر إرسال الطلب حاليًا. يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة.';
}

/**
 * Local datetime string (YYYY-MM-DDTHH:mm) for tomorrow at 09:00 — used as the
 * `min` of the visit date/time picker. Computed after mount to avoid any
 * SSR/client hydration drift on the attribute.
 */
function tomorrowAtNine(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContactForm({
  context,
  mode = 'info',
  eyebrow,
  initialValues,
  isAuthenticatedCustomer = false,
}: {
  context: ContactContext;
  /** 'visit' switches the form to a visit-request (needs a project + date). */
  mode?: 'info' | 'visit';
  /** Optional pill label shown above the heading (e.g. homepage). */
  eyebrow?: string;
  /**
   * Per-field prefill from the signed-in user's profile. Pages resolve this
   * on the server; the form treats each entry as optional so missing fields
   * stay editable. Identity stable across renders is not required — values
   * are seeded into `useState` once.
   */
  initialValues?: ContactPrefill;
  /**
   * When true, the form posts to the authenticated `/me/*` endpoints instead
   * of `/public/*` so the resulting row is linked to the user via `userId`.
   * Without this, a logged-in customer's submission stays orphaned and never
   * appears under /account/visits or /account/requests. Pages resolve this
   * server-side from the session — guests render with the flag off.
   */
  isAuthenticatedCustomer?: boolean;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState(initialValues?.fullName ?? '');
  const [phone, setPhone] = useState(initialValues?.phone ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [message, setMessage] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [minDate, setMinDate] = useState('');
  const utmRef = useRef<UtmAttribution>({});

  // A visit request requires a projectId (CreateVisitRequestDto). When the form
  // is in visit mode but no project context resolved, we safely fall back to an
  // info-request rather than POSTing a guaranteed-400 visit request.
  const isVisit = mode === 'visit' && Boolean(context.projectId);

  useEffect(() => {
    setMinDate(tomorrowAtNine());
    utmRef.current = captureUtm();
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'يرجى إدخال الاسم الكامل.';
    if (!phone.trim()) e.phone = 'يرجى إدخال رقم الهاتف.';
    else if (!PHONE_RE.test(phone.trim())) e.phone = 'يرجى إدخال رقم هاتف صحيح.';
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = 'صيغة البريد الإلكتروني غير صحيحة.';
    if (message.trim().length < 2) e.message = 'يرجى كتابة رسالتك.';
    if (isVisit) {
      if (!preferredDate) e.preferredDate = 'يرجى اختيار موعد الزيارة.';
      else if (minDate && preferredDate < minDate) e.preferredDate = 'يرجى اختيار موعد ابتداءً من الغد.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setErrorMsg('');

    const res = isVisit ? await submitVisit() : await submitInfo();

    if (res.ok) {
      trackEvent(isVisit ? 'visit_request_submit' : 'info_request_submit', {
        ...(context.projectId ? { project_id: context.projectId } : {}),
        ...(context.unitId ? { unit_id: context.unitId } : {}),
      });
      setStatus('success');
    } else {
      setStatus('error');
      const hasContext = Boolean(context.projectId || context.unitId);
      setErrorMsg(mapError(res.error.status, hasContext));
    }
  }

  function submitInfo(): Promise<ApiResult<unknown>> {
    // Logged-in CLIENT/CUSTOMER → `/me/info-requests` so the row gets
    // `userId` and shows up under /account/requests. Guests post to /public.
    const path = isAuthenticatedCustomer ? '/me/info-requests' : '/public/info-request';
    return safePost(path, {
      message: message.trim(),
      name: fullName.trim(),
      phone: phone.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(context.projectId ? { projectId: context.projectId } : {}),
      ...(context.unitId ? { unitId: context.unitId } : {}),
      ...utmRef.current,
    });
  }

  /** Visit request → /public/visit-request or /me/visit-requests. Only called when isVisit. */
  function submitVisit(): Promise<ApiResult<unknown>> {
    const path = isAuthenticatedCustomer ? '/me/visit-requests' : '/public/visit-request';
    return safePost(path, {
      // context.projectId is guaranteed present here (see isVisit).
      projectId: context.projectId,
      ...(context.unitId ? { unitId: context.unitId } : {}),
      preferredDate: new Date(preferredDate).toISOString(),
      notes: message.trim(),
      name: fullName.trim(),
      phone: phone.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...utmRef.current,
    });
  }

  function resetForAnother() {
    // Keep identity fields seeded so a logged-in user doesn't retype their
    // name/phone/email between requests. Guests get empty strings either way.
    setFullName(initialValues?.fullName ?? '');
    setPhone(initialValues?.phone ?? '');
    setEmail(initialValues?.email ?? '');
    setMessage('');
    setPreferredDate('');
    setErrors({});
    setStatus('idle');
  }

  if (status === 'success') {
    return (
      <PremiumCard className="p-8 text-center sm:p-10">
        <IconCircle tone="gold" className="mx-auto h-14 w-14">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </IconCircle>
        <h3 className="mt-5 text-2xl text-ink-strong">تم الإرسال بنجاح</h3>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">{SUCCESS}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">سيتواصل معك مستشار خلال وقت قصير.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href={routes.projects} variant="primary" size="md">
            استكشاف المشاريع
          </ButtonLink>
          <Button variant="outline" size="md" onClick={resetForAnother}>
            إرسال طلب آخر
          </Button>
        </div>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      {eyebrow && (
        <span className="inline-block rounded-full bg-gold-100/70 px-3.5 py-1.5 text-sm font-semibold text-gold-600">
          {eyebrow}
        </span>
      )}

      <h2 className={eyebrow ? 'mt-6 text-2xl text-ink-strong' : 'text-2xl text-ink-strong'}>
        {isVisit ? 'احجز زيارة' : 'أرسل استفسارك'}
      </h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
        <Clock3 className="h-4 w-4 text-gold-500" aria-hidden />
        {isVisit ? 'اختر الموعد المناسب وسنؤكّد زيارتك قريبًا.' : 'نرد عادةً خلال ساعة عمل واحدة.'}
      </p>

      {/* Context chip */}
      {(context.unitLabel || context.projectName || context.unitId || context.projectId) && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gold-100 px-3.5 py-2 text-sm text-gold-600">
          {context.unitId ? <HomeIcon className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
          <span>
            طلب متعلق بـ{' '}
            <span className="font-medium">
              {context.unitLabel ?? (context.unitId ? 'وحدة محددة' : context.projectName ?? 'مشروع محدد')}
            </span>
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="الاسم الكامل" required>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              invalid={!!errors.fullName}
              placeholder="مثال: محمد الأحمد"
              autoComplete="name"
            />
            <FormError>{errors.fullName}</FormError>
          </Field>
          <Field label="رقم الهاتف" required>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              invalid={!!errors.phone}
              placeholder="+966 5X XXX XXXX"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
            />
            <FormError>{errors.phone}</FormError>
          </Field>
        </div>

        <Field label="البريد الإلكتروني (اختياري)">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!errors.email}
            placeholder="you@example.com"
            dir="ltr"
            autoComplete="email"
          />
          <FormError>{errors.email}</FormError>
        </Field>
        <Field label="رسالتك" required>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            invalid={!!errors.message}
            placeholder="أخبرنا كيف يمكننا مساعدتك..."
          />
          <FormError>{errors.message}</FormError>
        </Field>

        {isVisit && (
          <Field label="موعد الزيارة المفضل" required>
            <Input
              type="datetime-local"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              invalid={!!errors.preferredDate}
              min={minDate || undefined}
              dir="ltr"
            />
            <FormError>{errors.preferredDate}</FormError>
          </Field>
        )}

        {status === 'error' && <InlineNotice tone="error">{errorMsg}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === 'submitting'}>
          {status === 'submitting' ? (
            'جارٍ الإرسال...'
          ) : (
            <>
              {isVisit ? <CalendarClock className="h-5 w-5" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
              {isVisit ? 'تأكيد طلب الزيارة' : 'إرسال الطلب'}
            </>
          )}
        </Button>
      </form>
    </PremiumCard>
  );
}
