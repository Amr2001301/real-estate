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
} from 'lucide-react';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';

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

  return (
    <div className="space-y-6" dir="rtl">
      <PremiumPageHero
        title="استيراد البيانات"
        description="استيراد المشاريع والوحدات والعملاء وفرص المبيعات من ملف Excel"
        breadcrumbs={[{ label: 'الإدارة' }, { label: 'استيراد البيانات' }]}
      />

      {/* ── File drop zone ─────────────────────────────────────────────────── */}
      {(phase.kind === 'idle' || phase.kind === 'error') && (
        <PremiumSectionCard title="رفع الملف" description="اختر ملف .xlsx أو اسحبه إلى هنا">
          <div className="p-6 space-y-4">
            <div
              className="border-2 border-dashed border-brand-300 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:bg-brand-50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-brand-400" />
              <p className="text-sm font-medium text-slate-700">اسحب الملف هنا أو اضغط للاختيار</p>
              <p className="text-2xs text-slate-400">.xlsx فقط — الحجم الأقصى 20 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {phase.kind === 'error' && (
              <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{phase.message}</span>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">قبل الاستيراد</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>صدِّر أولاً من صفحة «تصدير البيانات» للحصول على الملف الصحيح.</li>
                <li>أعمدة _Ref و_ImportId هي المفاتيح — لا تحذفها.</li>
                <li>أرقام الهاتف يجب أن تكون مصرية (01XXXXXXXXX أو +201XXXXXXXXX).</li>
              </ul>
            </div>
          </div>
        </PremiumSectionCard>
      )}

      {/* ── Previewing spinner ─────────────────────────────────────────────── */}
      {phase.kind === 'previewing' && (
        <PremiumSectionCard title="جاري التحليل…">
          <div className="flex items-center gap-3 p-8 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            <span className="text-sm">يتم تحليل الملف — قد يستغرق لحظة</span>
          </div>
        </PremiumSectionCard>
      )}

      {/* ── Importing spinner ──────────────────────────────────────────────── */}
      {phase.kind === 'importing' && (
        <PremiumSectionCard title="جاري الاستيراد…">
          <div className="flex items-center gap-3 p-8 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            <span className="text-sm">يتم الاستيراد — قد يستغرق دقيقة</span>
          </div>
        </PremiumSectionCard>
      )}

      {/* ── Preview result ─────────────────────────────────────────────────── */}
      {phase.kind === 'previewed' && (
        <>
          {/* Preview-only banner */}
          <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>معاينة فقط — لم تُكتب أي بيانات بعد.</strong> راجع الملخص أدناه
              ثم اضغط «استيراد» لتأكيد الكتابة.
            </span>
          </div>

          {/* Per-sheet summary */}
          <PremiumSectionCard title="ملخص الورقات" description="عدد الصفوف المتوقع بعد الاستيراد">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-slate-500 text-xs">
                    <th className="py-2 px-4 text-right font-medium">الورقة</th>
                    <th className="py-2 px-4 text-center font-medium text-success-600">إنشاء</th>
                    <th className="py-2 px-4 text-center font-medium text-brand-600">تحديث</th>
                    <th className="py-2 px-4 text-center font-medium text-slate-400">بدون تغيير</th>
                    <th className="py-2 px-4 text-center font-medium text-amber-600">مقفل</th>
                    <th className="py-2 px-4 text-center font-medium text-danger-600">أخطاء</th>
                  </tr>
                </thead>
                <tbody>
                  {PREVIEW_SHEETS.map((key) => {
                    const s = phase.plan[key];
                    const label = SHEET_LABELS[s.sheetName] ?? s.sheetName;
                    return (
                      <tr key={key} className="border-b border-hairline last:border-0 hover:bg-slate-50">
                        <td className="py-2 px-4 font-medium text-slate-700">{label}</td>
                        <td className="py-2 px-4 text-center text-success-700">{s.toCreate > 0 ? s.toCreate : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-4 text-center text-brand-700">{s.toUpdate > 0 ? s.toUpdate : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-4 text-center text-slate-400">{s.unchanged > 0 ? s.unchanged : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-4 text-center text-amber-600">{s.locked > 0 ? s.locked : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-4 text-center">
                          {s.errorCount > 0
                            ? <span className="text-danger-700 font-semibold">{s.errorCount}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PremiumSectionCard>

          {/* Locked rows callout */}
          {totalLockedPreview > 0 && (
            <PremiumSectionCard title="وحدات مقفلة" description="هذه الصفوف لن تُعدَّل">
              <div className="flex items-start gap-3 p-4 text-sm text-amber-800">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  <strong>{totalLockedPreview}</strong> وحدة مقفلة (لها عقد أو حجز نشط) — سيتجاهلها
                  الاستيراد تلقائياً دون تعديل. يمكنك متابعة الاستيراد بشكل طبيعي.
                </span>
              </div>
            </PremiumSectionCard>
          )}

          {/* Cross-tenant conflicts */}
          {phase.plan.crossTenantPhoneConflicts > 0 && (
            <PremiumSectionCard title="تعارضات في أرقام الهاتف">
              <div className="flex items-start gap-3 p-4 text-sm text-danger-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-500" />
                <span>
                  <strong>{phase.plan.crossTenantPhoneConflicts}</strong> صف مرفوض: رقم الهاتف
                  مسجَّل لعميل في شركة أخرى. المنصة لا تشارك الأرقام بين الشركات حالياً — يجب
                  إزالة هذه الصفوف من الملف.
                </span>
              </div>
            </PremiumSectionCard>
          )}

          {/* Unresolved sales reps */}
          {phase.plan.unresolvedLeadSalesReps > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{phase.plan.unresolvedLeadSalesReps}</strong> فرصة مبيعات: لم يُحدَّد مندوب
                المبيعات (اسم غير موجود أو متعدد). سيُترك الحقل فارغاً وتُستورد الفرصة.
              </span>
            </div>
          )}

          {/* Errors */}
          {allErrors.length > 0 && (
            <PremiumSectionCard
              title={`أخطاء (${allErrors.length})`}
              description="يجب إصلاح هذه الأخطاء قبل الاستيراد — القائمة تعرض أقصى 50 خطأ لكل ورقة"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-hairline text-slate-500">
                      <th className="py-2 px-4 text-right font-medium">الورقة</th>
                      <th className="py-2 px-4 text-center font-medium">الصف</th>
                      <th className="py-2 px-4 text-right font-medium">العمود</th>
                      <th className="py-2 px-4 text-right font-medium">الخطأ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allErrors.map((e, i) => (
                      <tr key={i} className="border-b border-hairline last:border-0 hover:bg-danger-50">
                        <td className="py-1.5 px-4 text-slate-600">{SHEET_LABELS[e.sheet] ?? e.sheet}</td>
                        <td className="py-1.5 px-4 text-center text-slate-500">{e.rowNumber}</td>
                        <td className="py-1.5 px-4 text-slate-500 font-mono">{e.column ?? '—'}</td>
                        <td className="py-1.5 px-4 text-danger-700">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PremiumSectionCard>
          )}

          {/* Warnings (collapsed) */}
          {allWarnings.length > 0 && (
            <PremiumSectionCard title={`تحذيرات (${allWarnings.length})`}>
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => setWarningsOpen((v) => !v)}
                >
                  <span>التحذيرات لا توقف الاستيراد — البيانات ستُستورد مع هذه الملاحظات</span>
                  {warningsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {warningsOpen && (
                  <div className="overflow-x-auto border-t border-hairline">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-hairline text-slate-500">
                          <th className="py-2 px-4 text-right font-medium">الورقة</th>
                          <th className="py-2 px-4 text-center font-medium">الصف</th>
                          <th className="py-2 px-4 text-right font-medium">العمود</th>
                          <th className="py-2 px-4 text-right font-medium">التحذير</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allWarnings.map((w, i) => (
                          <tr key={i} className="border-b border-hairline last:border-0">
                            <td className="py-1.5 px-4 text-slate-600">{SHEET_LABELS[w.sheet] ?? w.sheet}</td>
                            <td className="py-1.5 px-4 text-center text-slate-500">{w.rowNumber}</td>
                            <td className="py-1.5 px-4 text-slate-500 font-mono">{w.column ?? '—'}</td>
                            <td className="py-1.5 px-4 text-amber-700">{w.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </PremiumSectionCard>
          )}

          {/* Action row */}
          <div className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4">
            <button
              type="button"
              onClick={runImport}
              disabled={phase.plan.hasErrors}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              استيراد
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: 'idle' })}
              className="rounded-lg border border-hairline px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              اختر ملفاً آخر
            </button>
            {phase.plan.hasErrors && (
              <p className="text-sm text-danger-700 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 shrink-0" />
                يوجد أخطاء — أصلحها في الملف ثم أعد رفعه
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Import result ──────────────────────────────────────────────────── */}
      {phase.kind === 'done' && (
        <>
          <div className="flex items-start gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>اكتمل الاستيراد.</strong> أُنشئ{' '}
              <strong>{phase.result.totalCreated}</strong> سجل جديد وحُدِّث{' '}
              <strong>{phase.result.totalUpdated}</strong>.
            </span>
          </div>

          <PremiumSectionCard title="نتائج الاستيراد" description="الأعداد الفعلية التي كُتبت في قاعدة البيانات">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-slate-500 text-xs">
                    <th className="py-2 px-4 text-right font-medium">الورقة</th>
                    <th className="py-2 px-4 text-center font-medium text-success-600">أُنشئ</th>
                    <th className="py-2 px-4 text-center font-medium text-brand-600">حُدِّث</th>
                    <th className="py-2 px-4 text-center font-medium text-slate-400">بدون تغيير</th>
                    <th className="py-2 px-4 text-center font-medium text-amber-600">مقفل</th>
                  </tr>
                </thead>
                <tbody>
                  {RESULT_SHEETS.map((key) => {
                    const s = phase.result[key];
                    const label = SHEET_LABELS[s.sheetName] ?? s.sheetName;
                    return (
                      <tr key={key} className="border-b border-hairline last:border-0 hover:bg-slate-50">
                        <td className="py-2 px-4 font-medium text-slate-700">{label}</td>
                        <td className="py-2 px-4 text-center text-success-700">{s.created > 0 ? s.created : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-4 text-center text-brand-700">{s.updated > 0 ? s.updated : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-4 text-center text-slate-400">{s.unchanged > 0 ? s.unchanged : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-4 text-center text-amber-600">{s.locked > 0 ? s.locked : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PremiumSectionCard>

          {/* Partial-run note: per-sheet transactions mean some sheets may have committed while later ones failed */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-semibold mb-1">ملاحظة حول المعاملات</p>
            <p>
              كل ورقة تُستورد في معاملة مستقلة. إذا فشلت ورقة لاحقة بعد نجاح
              سابقتها، تبقى البيانات المُستوردة في الورقة الأولى دون تراجع.
              الأعداد أعلاه تعكس ما تمَّ فعلاً.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPhase({ kind: 'idle' })}
              className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              استيراد ملف جديد
            </button>
          </div>
        </>
      )}
    </div>
  );
}
