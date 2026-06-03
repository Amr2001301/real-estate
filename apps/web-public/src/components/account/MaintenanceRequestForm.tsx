'use client';

import { useEffect, useRef, useState } from 'react';
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

/** One selected attachment + its image preview URL (null for non-images). */
interface Attachment {
  id: string;
  file: File;
  url: string | null;
}

const ATTACH_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const ATTACH_ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const ATTACH_MAX_COUNT = 5;
const ATTACH_MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the "٥ ميجابايت" hint.

/** Arabic byte formatter for the selected-file rows. */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} كيلوبايت`;
  return `${(n / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachSeq = useRef(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [topError, setTopError] = useState('');

  // Revoke any outstanding object URLs on unmount to avoid memory leaks.
  const attachmentsRef = useRef<Attachment[]>(attachments);
  attachmentsRef.current = attachments;
  useEffect(
    () => () => {
      attachmentsRef.current.forEach((a) => {
        if (a.url) URL.revokeObjectURL(a.url);
      });
    },
    [],
  );

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    // Snapshot the FileList NOW. The <input> is reset synchronously after this
    // call, which empties the live FileList; deferring Array.from() into a
    // setState updater would therefore read zero files.
    const incoming = Array.from(list);
    const next = [...attachments];
    const messages: string[] = [];

    for (const file of incoming) {
      if (next.length >= ATTACH_MAX_COUNT) {
        messages.push(`يمكن إرفاق ${ATTACH_MAX_COUNT} ملفات كحد أقصى.`);
        break;
      }
      if (!ATTACH_ALLOWED.includes(file.type)) {
        messages.push(`نوع الملف غير مدعوم: ${file.name}. المسموح: PNG وJPG وWEBP وPDF.`);
        continue;
      }
      if (file.size > ATTACH_MAX_BYTES) {
        messages.push(`الملف كبير جدًا: ${file.name}. الحد الأقصى ٥ ميجابايت.`);
        continue;
      }
      // Skip exact duplicates (same name + size) silently.
      if (next.some((a) => a.file.name === file.name && a.file.size === file.size)) continue;

      const isImage = file.type.startsWith('image/');
      next.push({
        id: `att-${attachSeq.current++}`,
        file,
        url: isImage ? URL.createObjectURL(file) : null,
      });
    }

    setAttachments(next);
    const firstMessage = messages[0];
    setErrors((prev) => {
      const e = { ...prev };
      if (firstMessage) e.attachments = firstMessage;
      else delete e.attachments;
      return e;
    });
    if (status !== 'idle') setStatus('idle');
  }

  function removeFile(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
    setErrors((prev) => {
      if (!prev.attachments) return prev;
      const e = { ...prev };
      delete e.attachments;
      return e;
    });
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
    attachments.forEach((a) => fd.append('attachments', a.file, a.file.name));

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
          <p className="text-[10px] font-medium text-ink-muted">
            يدعم PNG, JPG, PDF حتى ٥ ميجابايت — حتى {ATTACH_MAX_COUNT} ملفات
          </p>
        </label>

        {attachments.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-soft p-2"
              >
                {a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, not an optimizable asset
                  <img
                    src={a.url}
                    alt={a.file.name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-ink-strong">{a.file.name}</span>
                  <span className="block text-[10px] font-medium text-ink-muted">{formatBytes(a.file.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(a.id)}
                  aria-label={`إزالة ${a.file.name}`}
                  className="shrink-0 rounded-lg p-1 text-ink-muted transition-colors hover:bg-error/10 hover:text-error"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <FormError>{errors.attachments}</FormError>
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
