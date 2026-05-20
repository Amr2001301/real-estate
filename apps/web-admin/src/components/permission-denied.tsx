import { ShieldAlert } from 'lucide-react';
import { getPermissionLabel } from '@/lib/permission-error';
import { cn } from '@/lib/cn';

interface Props {
  /** Permission codes the user is missing. Empty array → generic 403 message. */
  permissions?: string[];
  /** Override the default title (Arabic). */
  title?: string;
  /** Override the default description (Arabic). */
  description?: string;
  /** Optional CTA (e.g. "العودة للوحة التحكم"). */
  action?: React.ReactNode;
  /** Inline (smaller, single-line) vs full block. */
  variant?: 'block' | 'inline';
  className?: string;
}

/**
 * Friendly Arabic permission-denied state.
 *
 * Use anywhere a 403 with `code === 'missing_permission'` is detected
 * (typically: `safeRes.code === 'missing_permission'` from `safe()`).
 * Falls back to a generic forbidden message when `permissions` is empty,
 * so it doubles as the generic 403 component.
 */
export function PermissionDeniedState({
  permissions = [],
  title,
  description,
  action,
  variant = 'block',
  className,
}: Props) {
  const finalTitle = title ?? 'ليست لديك الصلاحية المطلوبة';
  const finalDescription =
    description ??
    (permissions.length > 0
      ? 'تواصل مع مسؤول النظام لمنحك الصلاحيات اللازمة لتنفيذ هذا الإجراء.'
      : 'لا تملك حالياً صلاحية الوصول إلى هذا المورد.');

  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm',
          className,
        )}
      >
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold">{finalTitle}</p>
          {permissions.length > 0 && (
            <p className="mt-1 text-xs">
              الصلاحيات المطلوبة:{' '}
              <PermissionList codes={permissions} />
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center text-center py-14 px-6 gap-3 rounded-2xl bg-warning-50/50 border border-warning-100',
        className,
      )}
    >
      <div className="h-12 w-12 inline-flex items-center justify-center rounded-2xl bg-warning-50 text-warning-700">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{finalTitle}</h3>
      <p className="text-sm text-slate-600 max-w-md">{finalDescription}</p>
      {permissions.length > 0 && (
        <div className="mt-1 text-xs text-slate-500">
          الصلاحيات المطلوبة:{' '}
          <PermissionList codes={permissions} />
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function PermissionList({ codes }: { codes: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {codes.map((code, idx) => {
        const label = getPermissionLabel(code);
        const hasLabel = label !== code;
        return (
          <span key={code} className="inline-flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 ring-1 ring-inset ring-warning-100 font-medium text-slate-700">
              {hasLabel && <span>{label}</span>}
              <span
                className={cn('font-mono text-2xs', hasLabel ? 'text-slate-400' : 'text-slate-700')}
                dir="ltr"
              >
                {code}
              </span>
            </span>
            {idx < codes.length - 1 && <span className="text-slate-300">،</span>}
          </span>
        );
      })}
    </span>
  );
}
