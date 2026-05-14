'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { loginAction, type LoginState } from './actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-8">

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700 text-right">
          البريد الإلكتروني
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ahmed@example.com"
          className="w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 text-right focus:outline-none focus:border-brand-600 transition-colors"
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700 text-right">
          كلمة المرور
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="••••••••••"
            className="w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 text-right pe-8 focus:outline-none focus:border-brand-600 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute start-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {state.error && (
        <p className="text-sm text-red-600 text-right bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1E3348] text-white py-3.5 text-sm font-semibold hover:bg-[#172b3c] active:scale-[0.98] disabled:opacity-60 transition-all duration-150"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            جاري تسجيل الدخول…
          </>
        ) : (
          <>
            تسجيل الدخول
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </>
        )}
      </button>

    </form>
  );
}
