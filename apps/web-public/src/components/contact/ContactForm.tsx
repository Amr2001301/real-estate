'use client';

import { useState } from 'react';
import { CheckCircle2, Send, Building2, Home as HomeIcon, CalendarDays, Clock3 } from 'lucide-react';
import { safePost, type ApiResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
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

type Mode = 'info' | 'visit';
type Status = 'idle' | 'submitting' | 'success' | 'error';

interface TabDef {
  mode: Mode;
  label: string;
}

/** Default tabs (project/unit-aware contexts, e.g. the /contact page). */
const DEFAULT_TABS: ReadonlyArray<TabDef> = [
  { mode: 'info', label: 'طلب معلومات' },
  { mode: 'visit', label: 'طلب زيارة' },
];

const PHONE_RE = /^[+\d][\d\s-]{6,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUCCESS: Record<Mode, string> = {
  info: 'تم إرسال طلبك بنجاح. سيتواصل معك أحد مستشارينا قريبًا.',
  visit: 'تم إرسال طلب الزيارة بنجاح. سنؤكد موعد الزيارة معك قريبًا.',
};

/** Map an API failure to a calm, specific Arabic message — never raw detail. */
function mapError(status: number, hasContext: boolean): string {
  if (status === 0) return 'تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.';
  if ((status === 400 || status === 404) && hasContext)
    return 'تعذر إرسال الطلب لهذا العقار حاليًا. اختر عقارًا آخر أو تواصل معنا مباشرة.';
  if (status === 400) return 'برجاء مراجعة البيانات المطلوبة.';
  return 'تعذر إرسال الطلب حاليًا. يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة.';
}

export function ContactForm({
  initialMode,
  context,
  tabs = DEFAULT_TABS,
  showTabs = true,
  eyebrow,
}: {
  initialMode: Mode;
  context: ContactContext;
  /** Override the tab set (e.g. the /contact page keeps "طلب زيارة"). */
  tabs?: ReadonlyArray<TabDef>;
  /** Hide the tab switcher and lock to the initial mode (e.g. homepage). */
  showTabs?: boolean;
  /** Pill label shown in place of the tabs when showTabs is false. */
  eyebrow?: string;
}) {
  const [activeTab, setActiveTab] = useState(() => {
    const i = tabs.findIndex((t) => t.mode === initialMode);
    return i >= 0 ? i : 0;
  });
  const mode: Mode = tabs[activeTab]?.mode ?? initialMode;
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  // A visit requires a project; we have one when the URL carried a projectId or
  // a unit we could resolve to its project.
  const visitNeedsProject = mode === 'visit' && !context.projectId;
  const today = new Date().toISOString().slice(0, 10);

  function switchTab(index: number) {
    setActiveTab(index);
    setErrors({});
    if (status === 'error') setStatus('idle');
  }

  function switchToMode(next: Mode) {
    const i = tabs.findIndex((t) => t.mode === next);
    if (i >= 0) switchTab(i);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'يرجى إدخال الاسم الكامل.';
    if (!phone.trim()) e.phone = 'يرجى إدخال رقم الهاتف.';
    else if (!PHONE_RE.test(phone.trim())) e.phone = 'يرجى إدخال رقم هاتف صحيح.';

    if (mode === 'info') {
      if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = 'صيغة البريد الإلكتروني غير صحيحة.';
      if (message.trim().length < 2) e.message = 'يرجى كتابة رسالتك.';
    } else {
      if (!date) e.date = 'يرجى اختيار تاريخ الزيارة.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (visitNeedsProject || !validate()) return;
    setStatus('submitting');
    setErrorMsg('');

    const res = mode === 'info' ? await submitInfo() : await submitVisit();

    if (res.ok) {
      setStatus('success');
    } else {
      setStatus('error');
      const hasContext = Boolean(context.projectId || context.unitId);
      setErrorMsg(mapError(res.error.status, hasContext));
    }
  }

  function submitInfo(): Promise<ApiResult<unknown>> {
    return safePost('/public/info-request', {
      message: message.trim(),
      name: fullName.trim(),
      phone: phone.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(context.projectId ? { projectId: context.projectId } : {}),
      ...(context.unitId ? { unitId: context.unitId } : {}),
    });
  }

  function submitVisit(): Promise<ApiResult<unknown>> {
    if (!context.projectId) {
      return Promise.resolve({ ok: false, error: { message: '', status: 400 } });
    }
    // Combine optional time into the ISO date the API expects.
    const preferredDate = time ? new Date(`${date}T${time}`).toISOString() : date;
    return safePost('/public/visit-request', {
      projectId: context.projectId,
      ...(context.unitId ? { unitId: context.unitId } : {}),
      preferredDate,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      name: fullName.trim(),
      phone: phone.trim(),
    });
  }

  function resetForAnother() {
    setFullName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setDate('');
    setTime('');
    setNotes('');
    setErrors({});
    setStatus('idle');
  }

  if (status === 'success') {
    return (
      <PremiumCard className="p-8 text-center sm:p-10">
        <IconCircle tone="gold" className="mx-auto h-14 w-14">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </IconCircle>
        <h3 className="mt-5 text-2xl text-navy">تم الإرسال بنجاح</h3>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">{SUCCESS[mode]}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          {mode === 'visit'
            ? 'سيتواصل معك مستشار لتأكيد موعد الزيارة خلال وقت قصير.'
            : 'سيتواصل معك مستشار خلال وقت قصير.'}
        </p>
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
      {/* Mode switcher — tabs, or a single-mode pill when locked (e.g. homepage) */}
      {showTabs ? (
        <div className="inline-flex rounded-full border border-hairline bg-surface-soft p-1">
          {tabs.map((t, i) => (
            <button
              key={`${t.mode}-${i}`}
              type="button"
              onClick={() => switchTab(i)}
              aria-pressed={i === activeTab}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-colors',
                i === activeTab ? 'bg-navy text-white shadow-soft' : 'text-ink-muted hover:text-navy',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <span className="inline-block rounded-full bg-gold-100/70 px-3.5 py-1.5 text-sm font-semibold text-gold-600">
          {eyebrow ?? tabs[activeTab]?.label}
        </span>
      )}

      <h2 className="mt-6 text-2xl text-navy">{mode === 'info' ? 'أرسل استفسارك' : 'طلب زيارة'}</h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
        <Clock3 className="h-4 w-4 text-gold-500" aria-hidden />
        نرد عادةً خلال ساعة عمل واحدة.
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

      {visitNeedsProject && (
        <div className="mt-5">
          <InlineNotice tone="info">
            لطلب زيارة محددة، يرجى اختيار مشروع أولًا. يمكنك تصفّح المشاريع أو إرسال استفسار عام.
          </InlineNotice>
          <div className="mt-3 flex flex-wrap gap-3">
            <ButtonLink href={routes.projects} variant="outline" size="sm">
              تصفّح المشاريع
            </ButtonLink>
            <Button variant="ghost" size="sm" onClick={() => switchToMode('info')}>
              إرسال استفسار عام
            </Button>
          </div>
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

        {mode === 'info' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="تاريخ الزيارة" required>
                <Input
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  invalid={!!errors.date}
                  disabled={visitNeedsProject}
                />
                <FormError>{errors.date}</FormError>
              </Field>
              <Field label="الوقت المفضل (اختياري)">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={visitNeedsProject} />
              </Field>
            </div>
            <Field label="ملاحظات (اختياري)">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي تفاصيل تساعدنا على تنظيم زيارتك..."
                disabled={visitNeedsProject}
              />
            </Field>
          </>
        )}

        {status === 'error' && <InlineNotice tone="error">{errorMsg}</InlineNotice>}

        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={status === 'submitting' || visitNeedsProject}
        >
          {status === 'submitting' ? (
            'جارٍ الإرسال...'
          ) : (
            <>
              {mode === 'visit' ? <CalendarDays className="h-5 w-5" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
              {mode === 'info' ? 'إرسال الطلب' : 'إرسال طلب الزيارة'}
            </>
          )}
        </Button>
      </form>
    </PremiumCard>
  );
}
