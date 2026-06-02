'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, UploadCloud, FileText, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { createMaintenanceRequestAction } from '@/lib/account-actions';
import { Button } from '@/components/ui/Button';
import { Select, Textarea, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';

export interface SelectOption {
  id: string;
  label: string;
}

type Status = 'idle' | 'submitting' | 'error';

const ATTACH_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const ATTACH_MAX_COUNT = 5;

/**
 * Create-maintenance form. Units come from the customer's contracts and
 * categories from the API; both validated client-side and re-validated in the
 * server action (which is the real authority alongside the backend).
 */
export function MaintenanceRequestForm({
  units,
  categories,
  initialUnitId = '',
}: {
  units: SelectOption[];
  categories: SelectOption[];
  initialUnitId?: string;
}) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(initialUnitId);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [topError, setTopError] = useState('');

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, ATTACH_MAX_COUNT));
    if (status !== 'idle') setStatus('idle');
  }
  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!unitId) e.unitId = 'يرجى اختيار الوحدة.';
    if (!categoryId) e.categoryId = 'يرجى اختيار فئة الصيانة.';
    if (description.trim().length < 5) e.description = 'يرجى كتابة وصف للمشكلة لا يقل عن ٥ أحرف.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setTopError('');

    const fd = new FormData();
    fd.append('unitId', unitId);
    fd.append('categoryId', categoryId);
    fd.append('description', description.trim());
    files.forEach((f) => fd.append('attachments', f, f.name));

    const res = await createMaintenanceRequestAction(fd);

    if (res.ok) {
      router.push(routes.accountMaintenance);
      router.refresh();
    } else {
      setStatus('error');
      if (res.field) setErrors((prev) => ({ ...prev, [res.field as string]: res.error }));
      else setTopError(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="الوحدة" required>
        <Select
          value={unitId}
          onChange={(e) => {
            setUnitId(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          invalid={!!errors.unitId}
        >
          <option value="">اختر الوحدة</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
        <FormError>{errors.unitId}</FormError>
      </Field>

      <Field label="فئة الصيانة" required>
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          invalid={!!errors.categoryId}
        >
          <option value="">اختر الفئة</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <FormError>{errors.categoryId}</FormError>
      </Field>

      <Field label="وصف المشكلة" required>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          invalid={!!errors.description}
          placeholder="اشرح المشكلة بالتفصيل ليتمكن فريقنا من مساعدتك..."
        />
        <FormError>{errors.description}</FormError>
      </Field>

      {/* Attachments — optional drag-and-drop / browse */}
      <Field label="المرفقات (اختياري)">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200',
            dragOver
              ? 'border-gold-400 bg-gold-100/20'
              : 'border-hairline bg-surface-soft/50 hover:border-gold-400 hover:bg-gold-100/10',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACH_ACCEPT}
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-600 transition-colors group-hover:bg-gold-200">
            <UploadCloud className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-xs font-bold text-ink-strong">اسحب الصور أو الملفات هنا أو تصفح من جهازك</p>
          <p className="text-[10px] font-medium text-ink-muted">يدعم PNG, JPG, PDF حتى ٥ ميجابايت</p>
        </label>

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-soft px-3 py-1.5 text-xs font-bold text-ink-strong"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`إزالة ${f.name}`}
                  className="text-ink-muted transition-colors hover:text-error"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>

      {status === 'error' && topError && <InlineNotice tone="error">{topError}</InlineNotice>}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === 'submitting'}>
        {status === 'submitting' ? (
          'جارٍ الإرسال...'
        ) : (
          <>
            <Send className="h-5 w-5" aria-hidden />
            إرسال الطلب
          </>
        )}
      </Button>
    </form>
  );
}
