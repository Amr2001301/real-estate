'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, UserPlus, Check, X, Loader2 } from 'lucide-react';
import type { User } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/form/field';
import { cn } from '@/lib/cn';

interface Props {
  /** Initial selected client (e.g. from `?clientId=` on the New Lead page). */
  initialClient?: User | null;
  /**
   * Hidden form fields are rendered with these names so the parent <form>
   * receives a stable shape regardless of which mode is active.
   *
   * - `clientIdName`  → submitted when an existing client is picked.
   * - `fullName/phone/email` → submitted when the inline "create new" form is
   *   used; the API resolves these into a User via find-or-create.
   */
  clientIdName?: string;
}

type Mode = 'pick' | 'create';

export function ClientPicker({ initialClient, clientIdName = 'clientId' }: Props) {
  const [mode, setMode] = useState<Mode>(initialClient ? 'pick' : 'pick');
  const [selected, setSelected] = useState<User | null>(initialClient ?? null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  // Debounced search against /users?q=…
  useEffect(() => {
    if (mode !== 'pick') return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // The clients section deals with both CLIENT and CUSTOMER roles.
        // We hit /users twice (one per role) and merge — keeps the API simple.
        const [a, b] = await Promise.all([
          fetch(
            `/api-proxy/users?role=CLIENT&pageSize=8&q=${encodeURIComponent(trimmed)}`,
            { credentials: 'include', signal: ctrl.signal },
          ).then((r) => (r.ok ? r.json() : { data: [] })),
          fetch(
            `/api-proxy/users?role=CUSTOMER&pageSize=4&q=${encodeURIComponent(trimmed)}`,
            { credentials: 'include', signal: ctrl.signal },
          ).then((r) => (r.ok ? r.json() : { data: [] })),
        ]);
        const merged: User[] = [
          ...((a as { data?: User[] }).data ?? []),
          ...((b as { data?: User[] }).data ?? []),
        ];
        setResults(merged.slice(0, 10));
      } catch {
        // ignore abort
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, mode]);

  if (mode === 'pick') {
    return (
      <div className="space-y-3">
        {/* Hidden form value */}
        <input type="hidden" name={clientIdName} value={selected?.id ?? ''} />

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">العميل المرتبط</p>
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setSelected(null);
            }}
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
          >
            <UserPlus className="h-3.5 w-3.5" />
            إنشاء عميل جديد بدلاً من ذلك
          </button>
        </div>

        {selected ? (
          <div className="flex items-center gap-3 rounded-2xl bg-success-50 border border-success-100 px-3 py-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-success-100 text-success-700 shrink-0">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {selected.fullName}
              </p>
              <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                {selected.phone ?? selected.email ?? '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQuery('');
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-surface-muted"
              aria-label="إزالة"
              title="إزالة"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="ابحث بالاسم، الهاتف، أو البريد…"
              leftAddon={<Search />}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              autoComplete="off"
            />
            {open && query.trim() && (
              <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-hairline bg-surface shadow-lg overflow-hidden">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    جاري البحث…
                  </div>
                )}
                {!loading && results.length === 0 && (
                  <div className="px-4 py-5 text-center">
                    <p className="text-sm text-slate-500">لا توجد نتائج لـ &quot;{query}&quot;</p>
                    <button
                      type="button"
                      onClick={() => setMode('create')}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      إنشاء عميل جديد
                    </button>
                  </div>
                )}
                {!loading &&
                  results.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => {
                        setSelected(u);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={cn(
                        'w-full text-start px-3 py-2.5 hover:bg-surface-muted transition-colors',
                        'flex items-center gap-3',
                      )}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold shrink-0">
                        {u.fullName.trim().charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {u.fullName}
                        </p>
                        <p className="text-2xs text-slate-500" dir="ltr">
                          {u.phone ?? u.email ?? '—'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-2xs font-semibold rounded-md px-1.5 py-0.5',
                          u.role === 'CUSTOMER'
                            ? 'bg-success-50 text-success-700'
                            : 'bg-info-50 text-info-700',
                        )}
                      >
                        {u.role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Create-new mode
  return (
    <div className="space-y-3 rounded-2xl ring-1 ring-inset ring-hairline bg-surface-muted/40 p-4">
      <input type="hidden" name={clientIdName} value="" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-brand-600" />
          عميل جديد
        </p>
        <button
          type="button"
          onClick={() => setMode('pick')}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <Search className="h-3.5 w-3.5" />
          استخدام عميل موجود
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="الاسم الكامل" name="fullName" required>
          <Input id="fullName" name="fullName" required minLength={2} />
        </Field>
        <Field
          label="رقم الهاتف"
          name="phone"
          hint="بصيغة E.164، مثال: +966500000001"
          required
        >
          <Input id="phone" name="phone" required dir="ltr" />
        </Field>
      </div>

      <Field label="البريد الإلكتروني (اختياري)" name="email">
        <Input id="email" name="email" type="email" dir="ltr" />
      </Field>

      <p className="text-2xs text-slate-500">
        إذا وُجد مستخدم بنفس الهاتف أو البريد سيتم استخدامه تلقائياً ولن يتم
        إنشاء سجل مكرر.
      </p>
    </div>
  );
}

export function ClientPickerActions({ onClear }: { onClear: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClear}>
      مسح الاختيار
    </Button>
  );
}
