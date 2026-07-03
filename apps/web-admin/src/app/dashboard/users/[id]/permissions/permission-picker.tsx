'use client';

import type { ReactNode } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ShieldCheck, CheckCircle2, AlertCircle, Loader2,
  CheckCheck, X, TrendingUp, Calendar, Bookmark, FileText,
  CreditCard, Wrench, BarChart3, Lock, LayoutGrid, Award,
  CircleDollarSign, Users as UsersIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  getPermissionMeta,
  PERMISSION_CATEGORIES,
  PERMISSION_TYPE_CLS,
  type PermissionType,
} from '@/lib/permission-labels';
import { cn } from '@/lib/cn';
import { applyUserPermissions } from './actions';

// ── Category icons (matches /dashboard/permissions catalog) ──────────────────

const CATEGORY_ICON: Record<string, ReactNode> = {
  'المبيعات':                 <TrendingUp />,
  'الزيارات':                 <Calendar />,
  'الحجوزات':                 <Bookmark />,
  'العقود':                   <FileText />,
  'الدفعات':                  <CreditCard />,
  'الصيانة':                  <Wrench />,
  'المستندات':                <FileText />,
  'الوسطاء':                  <UsersIcon />,
  'عمولات الوسطاء':           <CircleDollarSign />,
  'عمولات المبيعات':          <Award />,
  'التقارير':                 <BarChart3 />,
  'المستخدمون والصلاحيات':    <ShieldCheck />,
  'النظام والأمان':           <Lock />,
  'أخرى':                     <LayoutGrid />,
};

// ── Types ────────────────────────────────────────────────────────────────────

interface PermissionItem {
  id: string;
  code: string;
  description: string | null;
}

interface Props {
  userId: string;
  userName: string;
  assigned: PermissionItem[];
  available: PermissionItem[];
}

const CATEGORY_ORDER = new Map<string, number>(
  PERMISSION_CATEGORIES.map((c, i) => [c, i]),
);

interface Row extends PermissionItem {
  assigned: boolean;
  label: string;
  desc: string;
  group: string;
  type: PermissionType;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PermissionPicker({ userId, userName, assigned, available }: Props) {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError]       = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const allRows: Row[] = useMemo(() => {
    return [
      ...assigned.map((p) => ({ ...p, assigned: true })),
      ...available.map((p) => ({ ...p, assigned: false })),
    ]
      .map((p) => {
        const meta = getPermissionMeta(p.code, p.description);
        return { ...p, label: meta.label, desc: meta.description, group: meta.category, type: meta.type };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  }, [assigned, available]);

  const assignedCount = assigned.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      r.code.toLowerCase().includes(q) ||
      r.desc.toLowerCase().includes(q) ||
      r.label.toLowerCase().includes(q) ||
      r.group.toLowerCase().includes(q),
    );
  }, [allRows, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return [...map.entries()].sort(
      (a, b) => (CATEGORY_ORDER.get(a[0]) ?? 99) - (CATEGORY_ORDER.get(b[0]) ?? 99),
    );
  }, [filtered]);

  function run(add: string[], remove: string[], busy: string | null) {
    setError(null);
    setBusyCode(busy);
    startTransition(async () => {
      const result = await applyUserPermissions(userId, add, remove);
      setBusyCode(null);
      if (result.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  function toggle(row: Row) {
    if (row.assigned) run([], [row.code], row.code);
    else              run([row.code], [], row.code);
  }

  const matchUnassigned = filtered.filter((r) => !r.assigned).map((r) => r.code);
  const matchAssigned   = filtered.filter((r) =>  r.assigned).map((r) => r.code);

  return (
    <div className="space-y-4">

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* ── Toolbar card ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">

        {/* Count row */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline bg-canvas/40">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shrink-0 [&_svg]:h-4 [&_svg]:w-4">
              <ShieldCheck />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">الصلاحيات الممنوحة</p>
              <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                <span className="font-bold text-brand-700">{assignedCount}</span>
                {' '}من{' '}
                <span className="font-medium text-slate-600">{allRows.length}</span>
                {' '}صلاحية
              </p>
            </div>
          </div>
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              جارٍ الحفظ…
            </span>
          )}
        </div>

        {/* Search + bulk actions */}
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              inputSize="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الوصف أو القسم أو الرمز…"
              leftAddon={<Search />}
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || matchUnassigned.length === 0}
              onClick={() => run(matchUnassigned, [], null)}
              leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
            >
              تحديد{matchUnassigned.length > 0 ? ` (${matchUnassigned.length})` : ''}
            </Button>
            <span className="h-5 w-px bg-hairline shrink-0" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending || matchAssigned.length === 0}
              onClick={() => run([], matchAssigned, null)}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              leftIcon={<X className="h-3.5 w-3.5" />}
            >
              إلغاء{matchAssigned.length > 0 ? ` (${matchAssigned.length})` : ''}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Permission group cards ────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="bg-surface border border-hairline rounded-[20px] shadow-soft flex flex-col items-center justify-center py-16 gap-2.5">
          <ShieldCheck className="h-10 w-10 text-slate-200" />
          <p className="text-[13px] font-semibold text-slate-500">لا توجد صلاحيات مطابقة</p>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[12px] text-brand-600 hover:underline mt-0.5"
            >
              مسح البحث
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([group, rows]) => {
            const grantedInGroup = rows.filter((r) => r.assigned).length;
            const allGranted     = grantedInGroup === rows.length;
            const someGranted    = grantedInGroup > 0 && !allGranted;
            const icon           = CATEGORY_ICON[group] ?? <ShieldCheck />;

            return (
              <div
                key={group}
                className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden"
              >
                {/* Group header — same pattern as permissions catalog */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-surface-muted/40">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
                      {icon}
                    </span>
                    <h3 className="text-[13px] font-semibold text-slate-800">{group}</h3>
                  </div>
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-[40px] px-2 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                      allGranted  ? 'bg-success-100 text-success-700' :
                      someGranted ? 'bg-brand-100   text-brand-700'   :
                                    'bg-slate-100   text-slate-500',
                    )}
                  >
                    {grantedInGroup}/{rows.length}
                  </span>
                </div>

                {/* Permission rows */}
                <ul className="divide-y divide-hairline">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <label
                        className={cn(
                          'flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors',
                          row.assigned
                            ? 'bg-success-50/20 hover:bg-success-50/30'
                            : 'hover:bg-canvas/40',
                        )}
                      >
                        {/* Content — takes up the full row */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-slate-900 leading-tight">
                              {row.label}
                            </span>
                            <span
                              className={cn(
                                'inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold leading-tight shrink-0',
                                PERMISSION_TYPE_CLS[row.type],
                              )}
                            >
                              {row.type}
                            </span>
                            {busyCode === row.code && (
                              <Loader2 className="h-3 w-3 animate-spin text-slate-400 shrink-0" />
                            )}
                          </div>
                          {row.desc && (
                            <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                              {row.desc}
                            </p>
                          )}
                          <p className="font-mono text-[11px] text-slate-400 mt-1.5 select-all" dir="ltr">
                            {row.code}
                          </p>
                        </div>

                        {/* Granted tick OR checkbox */}
                        <div className="shrink-0 mt-0.5">
                          {row.assigned && busyCode !== row.code ? (
                            <CheckCircle2 className="h-5 w-5 text-success-500" />
                          ) : (
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-hairline text-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:opacity-40 cursor-pointer mt-0.5"
                              checked={row.assigned}
                              disabled={pending}
                              onChange={() => toggle(row)}
                            />
                          )}
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <p className="text-[11px] text-slate-400 px-1">
        التغييرات تُحفظ فوراً عند التحديد أو الإلغاء. لا يؤثر ذلك على دور{' '}
        <span className="font-medium text-slate-500">{userName}</span> الأساسي.
      </p>

    </div>
  );
}
