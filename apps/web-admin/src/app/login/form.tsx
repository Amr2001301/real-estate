'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Eye, EyeOff, Mail, Lock, Building2 } from 'lucide-react';
import { loginAction, type LoginState } from './actions';

export default function LoginForm({ from, lastCompanySlug }: { from?: string; lastCompanySlug?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-5">
      {from ? <input type="hidden" name="from" value={from} /> : null}

      {/* ── Company Code ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-[13px] font-semibold text-navy/70">
          كود الشركة
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            <Building2 className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <input
            name="slug"
            type="text"
            required
            autoComplete="organization"
            defaultValue={lastCompanySlug}
            placeholder="your-company"
            dir="ltr"
            className="h-[52px] w-full rounded-xl border border-hairline bg-surface pr-[2.625rem] pl-4 text-sm text-navy placeholder:text-text-muted transition-all focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
      </div>

      {/* ── Email ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-[13px] font-semibold text-navy/70">
          البريد الإلكتروني
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            <Mail className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ahmed@example.com"
            className="h-[52px] w-full rounded-xl border border-hairline bg-surface pr-[2.625rem] pl-4 text-sm text-navy placeholder:text-text-muted transition-all focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
      </div>

      {/* ── Password ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-[13px] font-semibold text-navy/70">
          كلمة المرور
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            <Lock className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="••••••••••"
            className="h-[52px] w-full rounded-xl border border-hairline bg-surface pr-[2.625rem] pl-[2.75rem] text-sm text-navy placeholder:text-text-muted transition-all focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted transition-colors hover:text-navy"
          >
            {showPassword ? (
              <EyeOff className="h-[17px] w-[17px]" />
            ) : (
              <Eye className="h-[17px] w-[17px]" />
            )}
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {state.error && (
        <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-600">{state.error}</p>
        </div>
      )}

      {/* ── Submit ───────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={pending}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-navy text-sm font-bold text-white shadow-soft transition-colors duration-150 ease-smooth hover:bg-navy-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            جاري تسجيل الدخول…
          </>
        ) : (
          'تسجيل الدخول'
        )}
      </button>

      <p className="text-center text-[13px] text-text-muted">
        <Link
          href="/forgot-password"
          className="text-navy/60 underline-offset-4 hover:text-navy hover:underline"
        >
          نسيت كلمة المرور؟
        </Link>
      </p>
    </form>
  );
}
