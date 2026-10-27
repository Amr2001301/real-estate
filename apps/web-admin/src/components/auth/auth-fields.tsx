'use client';

import { useId, useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/*
 * Fields, messages and the submit button of the pages before sign-in, in the
 * fixed dark palette of AuthShell (see there for why it ignores the theme).
 */

const INPUT =
  'h-[54px] w-full rounded-xl border border-white/[0.09] bg-white/[0.03] pr-12 text-[15px] text-[#F4EFE6] ' +
  'placeholder:text-[#566074] transition-[border-color,background-color,box-shadow] duration-200 ' +
  'hover:border-white/[0.16] focus:border-[#C8A24B]/70 focus:bg-white/[0.05] focus:outline-none ' +
  'focus:ring-4 focus:ring-[#C8A24B]/[0.12] autofill:shadow-[inset_0_0_0_100px_#0E1420] ' +
  '[&:-webkit-autofill]:[-webkit-text-fill-color:#F4EFE6]';

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export function AuthField({
  label,
  icon: Icon,
  trailing,
  className,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: IconType; trailing?: ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-2.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#C9CFDA]">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7588] transition-colors group-focus-within:text-[#C8A24B]">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <input id={id} {...input} className={`${INPUT} ${trailing ? 'pl-12' : 'pl-4'} ${className ?? ''}`} />
        {trailing}
      </div>
    </div>
  );
}

export function AuthPasswordField(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; icon: IconType },
) {
  const [shown, setShown] = useState(false);
  return (
    <AuthField
      {...props}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          tabIndex={-1}
          aria-label={shown ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#6B7588] transition-colors hover:text-[#F4EFE6]"
        >
          {shown ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      }
    />
  );
}

export function AuthSubmit({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={AUTH_BUTTON}
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A1406]/25 border-t-[#1A1406]" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** The gold call to action — also for links styled as the page's main button. */
export const AUTH_BUTTON =
  'relative flex h-[54px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl ' +
  'bg-gradient-to-l from-[#E2C77F] via-[#C8A24B] to-[#B08A38] text-[15px] font-bold text-[#1A1406] ' +
  'shadow-[0_10px_30px_-10px_rgba(200,162,75,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ' +
  'transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.99] ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C8A24B]/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const AUTH_LINK =
  'text-[13px] font-semibold text-[#C8A24B] underline-offset-4 transition-colors hover:text-[#E2C77F] hover:underline';

export function AuthMessage({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: ReactNode }) {
  const styles = {
    error: 'border-[#F09687]/25 bg-[#F09687]/[0.08] text-[#F5B4A9]',
    success: 'border-[#86C9A0]/25 bg-[#86C9A0]/[0.08] text-[#A9DBBC]',
    warning: 'border-[#E8B96E]/25 bg-[#E8B96E]/[0.08] text-[#EECB91]',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}
