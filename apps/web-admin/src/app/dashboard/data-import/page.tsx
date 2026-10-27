'use client';

/**
 * Data-import page — two-step flow:
 *   1. Select .xlsx → POST /api/import?target=preview → render plan summary
 *   2. Explicit "استيراد" button → POST /api/import?target=import → render result
 *
 * The preview is a safety gate. Importing is never automatic after a preview.
 * The import button is disabled (and the reason stated) when hasErrors is true.
 */

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  Info,
  XCircle,
  Loader2,
  Check,
  Download,
  FolderOpen,
  ShieldCheck,
  PlusCircle,
  RefreshCw,
  MinusCircle,
  Building2,
  Layers,
  Landmark,
  DoorOpen,
  Users,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { PremiumPageHero } from '@/components/premium';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SheetSummary {
  sheetName: string;
  toCreate: number;
  toUpdate: number;
  unchanged: number;
  locked: number;
  errorCount: number;
  errors: Array<{ sheet: string; rowNumber: number; column?: string; message: string }>;
  warnings: Array<{ sheet: string; rowNumber: number; column?: string; message: string }>;
}

interface PreviewResponse {
  hasErrors: boolean;
  crossTenantPhoneConflicts: number;
  unresolvedLeadSalesReps: number;
  projects: SheetSummary;
  phases: SheetSummary;
  buildings: SheetSummary;
  units: SheetSummary;
  customers: SheetSummary;
  leads: SheetSummary;
}

interface SheetResultSummary {
  sheetName: string;
  created: number;
  updated: number;
  unchanged: number;
  locked: number;
  warnings: Array<{ sheet: string; rowNumber: number; column?: string; message: string }>;
}

interface ImportResponse {
  success: boolean;
  hasErrors: boolean;
  totalCreated: number;
  totalUpdated: number;
  totalUnchanged: number;
  crossTenantPhoneConflicts: number;
  unresolvedLeadSalesReps: number;
  projects: SheetResultSummary;
  phases: SheetResultSummary;
  buildings: SheetResultSummary;
  units: SheetResultSummary;
  customers: SheetResultSummary;
  leads: SheetResultSummary;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const SHEET_LABELS: Record<string, string> = {
  Projects: 'المشاريع',
  Phases: 'المراحل',
  Buildings: 'المباني',
  Units: 'الوحدات',
  Customers: 'العملاء',
  Leads: 'فرص المبيعات',
};

const PREVIEW_SHEETS: (keyof Omit<PreviewResponse, 'hasErrors' | 'crossTenantPhoneConflicts' | 'unresolvedLeadSalesReps'>)[] =
  ['projects', 'phases', 'buildings', 'units', 'customers', 'leads'];

const RESULT_SHEETS: (keyof Omit<ImportResponse, 'success' | 'hasErrors' | 'totalCreated' | 'totalUpdated' | 'totalUnchanged' | 'crossTenantPhoneConflicts' | 'unresolvedLeadSalesReps'>)[] =
  ['projects', 'phases', 'buildings', 'units', 'customers', 'leads'];

// ── State machine ─────────────────────────────────────────────────────────────

type Phase =
  | { kind: 'idle' }
  | { kind: 'previewing' }
  | { kind: 'previewed'; plan: PreviewResponse; file: File }
  | { kind: 'importing'; plan: PreviewResponse; file: File }
  | { kind: 'done'; result: ImportResponse }
  | { kind: 'error'; message: string };

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataImportPage() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File validation ──────────────────────────────────────────────────────────

  const validateFile = useCallback((f: File): string | null => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      return 'يجب أن يكون الملف بصيغة .xlsx';
    }
    if (f.size > MAX_FILE_BYTES) {
      return `حجم الملف (${(f.size / 1024 / 1024).toFixed(1)} MB) يتجاوز الحد الأقصى (20 MB)`;
    }
    return null;
  }, []);

  // ── Preview ──────────────────────────────────────────────────────────────────

  const runPreview = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) { setPhase({ kind: 'error', message: err }); return; }

    setPhase({ kind: 'previewing' });

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/import?target=preview', { method: 'POST', body: fd });
      const json = await res.json() as PreviewResponse;
      if (!res.ok) {
        const msg = (json as unknown as { message?: string }).message ?? `خطأ ${res.status}`;
        setPhase({ kind: 'error', message: msg });
        return;
      }
      setPhase({ kind: 'previewed', plan: json, file });
      setWarningsOpen(false);
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message ?? 'حدث خطأ غير متوقع' });
    }
  }, [validateFile]);

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) runPreview(f);
  }, [runPreview]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runPreview(f);
    e.target.value = '';
  }, [runPreview]);

  // ── Import ───────────────────────────────────────────────────────────────────

  const runImport = useCallback(async () => {
    if (phase.kind !== 'previewed') return;
    const { file, plan } = phase;

    setPhase({ kind: 'importing', plan, file });

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/import?target=import', { method: 'POST', body: fd });
      const json = await res.json() as ImportResponse;
      if (!res.ok) {
        const msg = (json as unknown as { message?: string }).message ?? `خطأ ${res.status}`;
        setPhase({ kind: 'error', message: msg });
        return;
      }
      setPhase({ kind: 'done', result: json });
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message ?? 'حدث خطأ غير متوقع' });
    }
  }, [phase]);

  // ── Collect all errors and warnings ─────────────────────────────────────────

  const allErrors = phase.kind === 'previewed'
    ? PREVIEW_SHEETS.flatMap((s) => phase.plan[s].errors)
    : [];
  const allWarnings = phase.kind === 'previewed'
    ? PREVIEW_SHEETS.flatMap((s) => phase.plan[s].warnings)
    : [];
  const totalLockedPreview = phase.kind === 'previewed'
    ? PREVIEW_SHEETS.reduce((n, s) => n + phase.plan[s].locked, 0)
    : 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  const step = phase.kind === 'done' ? 3 : phase.kind === 'previewed' || phase.kind === 'importing' ? 2 : 1;
  const busy = phase.kind === 'previewing' || phase.kind === 'importing';
  const plan = phase.kind === 'previewed' || phase.kind === 'importing' ? phase.plan : null;
  const file = phase.kind === 'previewed' || phase.kind === 'importing' ? phase.file : null;

  return (
    <div className="space-y-6" dir="rtl">
      <PremiumPageHero
        title="استيراد البيانات"
        description="انقل مشاريعك ووحداتك وعملاءك وفرص المبيعات إلى المنصة من ملف Excel — بمعاينة كاملة قبل أي تغيير."
        breadcrumbs={[{ label: 'الإدارة' }, { label: 'استيراد البيانات' }]}
      />

      <Stepper step={step} />

      {/* ── 1. Choose the file ─────────────────────────────────────────────── */}
      {(phase.kind === 'idle' || phase.kind === 'error') && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className={CARD}>
            <div
              role="button"
              tabIndex={0}
              data-testid="import-drop"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                setDragging(false);
                onDrop(e);
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              className={cn(
                'group relative m-2 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[20px] border-2 border-dashed px-6 py-14 text-center transition-colors',
                dragging ? 'border-brand-500 bg-brand-50' : 'border-brand-400/40 bg-canvas/40 hover:border-brand-500/70 hover:bg-brand-50/50',
              )}
            >
              <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
              <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-[26px] bg-navy-band text-[#D8B66A] shadow-[0_20px_40px_-18px_rgb(14_22_38/0.7)] transition-transform group-hover:-translate-y-1">
                <FileSpreadsheet className="h-9 w-9 stroke-[1.5]" />
                <span className="absolute -bottom-1.5 -end-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-[#1A1406] ring-4 ring-surface">
                  <Upload className="h-4 w-4" />
                </span>
              </span>
              <p className="relative mt-6 font-heading text-[20px] font-bold text-slate-900">
                {dragging ? 'أفلت الملف هنا' : 'اسحب ملف Excel هنا'}
              </p>
              <p className="relative mt-1.5 text-[13px] text-slate-500">أو</p>
              <span className="relative mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-navy-band px-6 text-[13.5px] font-semibold text-[#F4ECD8]">
                <FolderOpen className="h-4 w-4" />
                اختر ملفًا من جهازك
              </span>
              <p className="relative mt-5 flex flex-wrap items-center justify-center gap-2 text-[11.5px] text-slate-500">
                <span className="rounded-full bg-surface px-2.5 py-1 ring-1 ring-inset ring-hairline" dir="ltr">.xlsx</span>
                <span className="rounded-full bg-surface px-2.5 py-1 ring-1 ring-inset ring-hairline">حتى 20 ميجابايت</span>
                <span className="rounded-full bg-surface px-2.5 py-1 ring-1 ring-inset ring-hairline">لا يُكتب شيء قبل تأكيدك</span>
              </p>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={onFileChange} />
            </div>

            {phase.kind === 'error' && (
              <div role="alert" className="mx-2 mb-2 flex items-start gap-2.5 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{phase.message}</span>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <section className={cn(CARD, 'p-5')}>
              <h2 className="font-heading text-[16px] font-bold text-slate-900">قبل ما تبدأ</h2>
              <ol className="mt-4 space-y-3.5">
                {[
                  { t: 'ابدأ من ملف التصدير', d: 'نزّل بياناتك الحالية من «تصدير البيانات» واملأ عليها — بنفس الأعمدة.' },
                  { t: 'لا تحذف أعمدة المفاتيح', d: 'العمودان _Ref و _ImportId يربطان كل صف بسجله.' },
                  { t: 'أرقام هواتف مصرية', d: '01XXXXXXXXX أو ‎+201XXXXXXXXX.' },
                ].map((x, i) => (
                  <li key={x.t} className="flex gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 ring-1 ring-inset ring-brand-400/30">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-[13px] font-bold text-slate-800">{x.t}</span>
                      <span className="block text-[12px] leading-relaxed text-slate-500">{x.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                href="/dashboard/data-export"
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-brand-400/50 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                <Download className="h-4 w-4" />
                تنزيل ملف التصدير
              </Link>
            </section>

            <section className={cn(CARD, 'p-5')}>
              <h2 className="text-[13.5px] font-bold text-slate-800">ما يمكن استيراده</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {SHEETS.map(({ name, Icon }) => (
                  <span key={name} className="flex items-center gap-2 rounded-xl bg-surface-muted/60 px-3 py-2 text-[12.5px] font-semibold text-slate-700">
                    <Icon className="h-4 w-4 text-brand-700" />
                    {SHEET_LABELS[name]}
                  </span>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* ── Working ─────────────────────────────────────────────────────────── */}
      {busy && (
        <section className={cn(CARD, 'flex flex-col items-center px-6 py-14 text-center')} role="status">
          <span className="relative inline-flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-navy-band text-[#D8B66A]">
              <Loader2 className="h-7 w-7 animate-spin" />
            </span>
          </span>
          <p className="mt-5 font-heading text-[18px] font-bold text-slate-900">
            {phase.kind === 'previewing' ? 'نقرأ الملف ونجهّز المعاينة…' : 'جارٍ الاستيراد…'}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            {phase.kind === 'previewing' ? 'لحظات — لا يُكتب أي شيء الآن.' : 'قد يستغرق دقيقة — لا تغلق الصفحة.'}
          </p>
        </section>
      )}

      {/* ── 2. Review ───────────────────────────────────────────────────────── */}
      {plan && phase.kind === 'previewed' && (
        <>
          <FileBar file={file!} onChange={() => setPhase({ kind: 'idle' })} />

          <div className="flex items-start gap-3 rounded-2xl border border-info-100 bg-info-50 px-5 py-3.5 text-[13px] text-info-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>معاينة فقط — لم تُكتب أي بيانات بعد.</strong> راجع ما سيحدث، ثم اضغط «تأكيد الاستيراد».
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="سجلات جديدة" value={sum(plan, 'toCreate')} tone="success" Icon={PlusCircle} />
            <Tile label="سيتم تحديثها" value={sum(plan, 'toUpdate')} tone="gold" Icon={RefreshCw} />
            <Tile label="بدون تغيير" value={sum(plan, 'unchanged')} tone="muted" Icon={MinusCircle} />
            <Tile label="أخطاء" value={sum(plan, 'errorCount')} tone={plan.hasErrors ? 'danger' : 'muted'} Icon={XCircle} />
          </div>

          <section className={cn(CARD, 'p-5')}>
            <h2 className="font-heading text-[16px] font-bold text-slate-900">حسب الورقة</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PREVIEW_SHEETS.map((key) => {
                const s = plan[key];
                return (
                  <SheetCard
                    key={key}
                    name={s.sheetName}
                    parts={[
                      { n: s.toCreate, label: 'جديد', cls: 'bg-success-600' },
                      { n: s.toUpdate, label: 'تحديث', cls: 'bg-brand-500' },
                      { n: s.unchanged, label: 'كما هو', cls: 'bg-slate-300' },
                      { n: s.locked, label: 'مقفل', cls: 'bg-amber-400' },
                    ]}
                    errors={s.errorCount}
                  />
                );
              })}
            </div>
          </section>

          {(totalLockedPreview > 0 || plan.crossTenantPhoneConflicts > 0 || plan.unresolvedLeadSalesReps > 0) && (
            <div className="grid gap-3 lg:grid-cols-3">
              {totalLockedPreview > 0 && (
                <Notice tone="warning" Icon={Lock} title={`${totalLockedPreview} وحدة مقفلة`}>
                  لها عقد أو حجز نشط — سيتخطاها الاستيراد دون تعديل، ويكمل الباقي.
                </Notice>
              )}
              {plan.crossTenantPhoneConflicts > 0 && (
                <Notice tone="danger" Icon={AlertTriangle} title={`${plan.crossTenantPhoneConflicts} صف مرفوض`}>
                  رقم الهاتف مسجّل لعميل في شركة أخرى — احذف هذه الصفوف من الملف.
                </Notice>
              )}
              {plan.unresolvedLeadSalesReps > 0 && (
                <Notice tone="info" Icon={Info} title={`${plan.unresolvedLeadSalesReps} فرصة بدون مندوب`}>
                  اسم المندوب غير موجود أو مكرر — ستُستورد الفرصة بدون مندوب.
                </Notice>
              )}
            </div>
          )}

          {allErrors.length > 0 && (
            <IssueTable
              tone="danger"
              title={`أخطاء يجب إصلاحها (${allErrors.length})`}
              hint="صحّحها في الملف ثم ارفعه من جديد — تُعرض حتى 50 خطأ لكل ورقة."
              rows={allErrors}
              open
            />
          )}
          {allWarnings.length > 0 && (
            <IssueTable
              tone="warning"
              title={`ملاحظات (${allWarnings.length})`}
              hint="لا توقف الاستيراد — البيانات ستُستورد معها."
              rows={allWarnings}
              open={warningsOpen}
              onToggle={() => setWarningsOpen((v) => !v)}
            />
          )}

          {/* Sticky confirm bar */}
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-[20px] border border-hairline bg-surface/95 p-4 shadow-[0_24px_60px_-28px_rgb(14_22_38/0.55)] backdrop-blur">
            <button
              type="button"
              onClick={runImport}
              disabled={plan.hasErrors}
              data-testid="import-confirm"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-l from-[#E2C77F] via-[#C8A24B] to-[#B08A38] px-6 text-[13.5px] font-bold text-[#1A1406] shadow-[0_10px_30px_-12px_rgb(200_162_75/0.7)] transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <CheckCircle2 className="h-4 w-4" />
              تأكيد الاستيراد
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: 'idle' })}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline px-5 text-[13px] font-semibold text-slate-600 hover:text-slate-900"
            >
              اختيار ملف آخر
            </button>
            {plan.hasErrors ? (
              <p className="ms-auto flex items-center gap-1.5 text-[13px] text-danger-700">
                <XCircle className="h-4 w-4 shrink-0" />
                يوجد أخطاء — أصلحها في الملف ثم أعد رفعه
              </p>
            ) : (
              <p className="ms-auto text-[12.5px] text-slate-500">
                سيُنشأ {sum(plan, 'toCreate')} سجل ويُحدَّث {sum(plan, 'toUpdate')}.
              </p>
            )}
          </div>
        </>
      )}

      {/* ── 3. Done ─────────────────────────────────────────────────────────── */}
      {phase.kind === 'done' && (
        <>
          <section className={cn(CARD, 'relative overflow-hidden px-6 py-10 text-center')}>
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-success-600/10 blur-3xl" />
            <span className="relative mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-600 ring-8 ring-success-50/50">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <p className="relative mt-4 font-heading text-[22px] font-bold text-slate-900">اكتمل الاستيراد</p>
            <p className="relative mt-1 text-[13.5px] text-slate-500">
              أُنشئ <strong className="text-slate-800">{phase.result.totalCreated}</strong> سجل جديد، وحُدِّث{' '}
              <strong className="text-slate-800">{phase.result.totalUpdated}</strong>، وبقي{' '}
              <strong className="text-slate-800">{phase.result.totalUnchanged}</strong> كما هو.
            </p>
          </section>

          <section className={cn(CARD, 'p-5')}>
            <h2 className="font-heading text-[16px] font-bold text-slate-900">ما تمّ فعلًا</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {RESULT_SHEETS.map((key) => {
                const s = phase.result[key];
                return (
                  <SheetCard
                    key={key}
                    name={s.sheetName}
                    parts={[
                      { n: s.created, label: 'أُنشئ', cls: 'bg-success-600' },
                      { n: s.updated, label: 'حُدِّث', cls: 'bg-brand-500' },
                      { n: s.unchanged, label: 'كما هو', cls: 'bg-slate-300' },
                      { n: s.locked, label: 'مقفل', cls: 'bg-amber-400' },
                    ]}
                  />
                );
              })}
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-slate-400">
              كل ورقة تُستورد وحدها: إن تعثّرت ورقة لاحقة تبقى السابقة كما استُوردت — الأعداد أعلاه هي ما كُتب فعلًا.
            </p>
          </section>

          <button
            type="button"
            onClick={() => setPhase({ kind: 'idle' })}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-navy-band px-6 text-[13.5px] font-semibold text-[#F4ECD8]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            استيراد ملف جديد
          </button>
        </>
      )}
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

const CARD = 'rounded-[22px] border border-hairline bg-surface shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]';

const SHEETS = [
  { name: 'Projects', Icon: Building2 },
  { name: 'Phases', Icon: Layers },
  { name: 'Buildings', Icon: Landmark },
  { name: 'Units', Icon: DoorOpen },
  { name: 'Customers', Icon: Users },
  { name: 'Leads', Icon: TrendingUp },
];
const SHEET_ICON = Object.fromEntries(SHEETS.map((s) => [s.name, s.Icon]));

function sum(plan: PreviewResponse, k: 'toCreate' | 'toUpdate' | 'unchanged' | 'errorCount'): number {
  return PREVIEW_SHEETS.reduce((n, s) => n + plan[s][k], 0);
}

function Stepper({ step }: { step: number }) {
  const steps = ['اختر الملف', 'راجع المعاينة', 'تمّ الاستيراد'];
  return (
    <ol className="flex items-center gap-3" data-testid="import-steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className={cn('flex items-center gap-3', i < steps.length - 1 && 'flex-1')}>
            <span
              className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold transition-colors',
                done && 'bg-success-600 text-white',
                active && 'bg-navy-band text-[#D8B66A] ring-4 ring-brand-500/20',
                !done && !active && 'bg-surface text-slate-400 ring-1 ring-inset ring-hairline',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </span>
            <span className={cn('whitespace-nowrap text-[13px] font-semibold', active ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400')}>
              {label}
            </span>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', done ? 'bg-success-600/50' : 'bg-hairline')} />}
          </li>
        );
      })}
    </ol>
  );
}

function FileBar({ file, onChange }: { file: File; onChange: () => void }) {
  return (
    <div className={cn(CARD, 'flex flex-wrap items-center gap-4 px-5 py-4')}>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-success-50 text-success-600">
        <FileSpreadsheet className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p dir="ltr" className="truncate text-start text-[14px] font-bold text-slate-900">
          {file.name}
        </p>
        <p className="text-[12px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} ميجابايت</p>
      </div>
      <button type="button" onClick={onChange} className="text-[12.5px] font-semibold text-brand-700 underline-offset-4 hover:underline">
        تغيير الملف
      </button>
    </div>
  );
}

const TILE_TONE = {
  success: 'bg-success-50 text-success-600',
  gold: 'bg-brand-50 text-brand-700',
  muted: 'bg-surface-muted text-slate-500',
  danger: 'bg-danger-50 text-danger-600',
};

function Tile({ label, value, tone, Icon }: { label: string; value: number; tone: keyof typeof TILE_TONE; Icon: typeof Info }) {
  return (
    <div className={cn(CARD, 'flex items-center gap-3.5 p-4')}>
      <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', TILE_TONE[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="num text-[28px] font-semibold leading-none text-slate-900">{value.toLocaleString('en')}</p>
        <p className="mt-1 text-[12px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function SheetCard({ name, parts, errors = 0 }: { name: string; parts: Array<{ n: number; label: string; cls: string }>; errors?: number }) {
  const Icon = SHEET_ICON[name] ?? FileSpreadsheet;
  const total = parts.reduce((n, p) => n + p.n, 0);
  return (
    <div className={cn('rounded-2xl border bg-surface p-4', errors > 0 ? 'border-danger-100' : 'border-hairline')}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-navy-band text-[#D8B66A]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-[14px] font-bold text-slate-900">{SHEET_LABELS[name] ?? name}</span>
        {errors > 0 ? (
          <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-700">{errors} خطأ</span>
        ) : (
          <span className="num text-[18px] font-semibold text-slate-400">{total}</span>
        )}
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
        {total > 0 && parts.map((p) => (p.n > 0 ? <span key={p.label} className={p.cls} style={{ width: `${(p.n / total) * 100}%` }} /> : null))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
        {total === 0 ? (
          <span className="text-slate-400">لا صفوف</span>
        ) : (
          parts
            .filter((p) => p.n > 0)
            .map((p) => (
              <span key={p.label} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', p.cls)} />
                {p.label} <strong className="text-slate-700">{p.n}</strong>
              </span>
            ))
        )}
      </div>
    </div>
  );
}

const NOTICE_TONE = {
  warning: 'border-warning-100 bg-warning-50 text-warning-700',
  danger: 'border-danger-100 bg-danger-50 text-danger-700',
  info: 'border-info-100 bg-info-50 text-info-700',
};

function Notice({ tone, Icon, title, children }: { tone: keyof typeof NOTICE_TONE; Icon: typeof Info; title: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3.5', NOTICE_TONE[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-[13px] font-bold">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed opacity-90">{children}</p>
      </div>
    </div>
  );
}

function IssueTable({
  tone,
  title,
  hint,
  rows,
  open,
  onToggle,
}: {
  tone: 'danger' | 'warning';
  title: string;
  hint: string;
  rows: Array<{ sheet: string; rowNumber: number; column?: string; message: string }>;
  open: boolean;
  onToggle?: () => void;
}) {
  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-start disabled:cursor-default"
      >
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', tone === 'danger' ? 'bg-danger-50 text-danger-600' : 'bg-warning-50 text-warning-700')}>
          {tone === 'danger' ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-bold text-slate-900">{title}</span>
          <span className="block text-[12px] text-slate-500">{hint}</span>
        </span>
        {onToggle && (open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />)}
      </button>
      {open && (
        <div className="max-h-[420px] overflow-auto border-t border-hairline scrollbar-thin">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0">
              <tr>
                <th className="px-5 py-2.5 text-start">الورقة</th>
                <th className="px-3 py-2.5 text-center">الصف</th>
                <th className="px-3 py-2.5 text-start">العمود</th>
                <th className="px-5 py-2.5 text-start">{tone === 'danger' ? 'الخطأ' : 'الملاحظة'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((e, i) => (
                <tr key={i} className="hover:bg-canvas/50">
                  <td className="px-5 py-2.5 font-semibold text-slate-700">{SHEET_LABELS[e.sheet] ?? e.sheet}</td>
                  <td className="num px-3 py-2.5 text-center text-slate-500">{e.rowNumber}</td>
                  <td className="px-3 py-2.5 font-mono text-[11.5px] text-slate-500">{e.column ?? '—'}</td>
                  <td className={cn('px-5 py-2.5', tone === 'danger' ? 'text-danger-700' : 'text-warning-700')}>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
