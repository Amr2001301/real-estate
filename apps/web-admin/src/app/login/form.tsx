'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">كلمة المرور</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 text-white py-2 font-medium hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'جاري تسجيل الدخول…' : 'تسجيل الدخول'}
      </button>
    </form>
  );
}
