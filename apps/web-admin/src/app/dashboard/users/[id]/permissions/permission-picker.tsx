'use client';

import type { ReactNode } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ShieldCheck, AlertCircle, Loader2,
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
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { cn } from '@/lib/cn';
import { applyUserPermissions } from './actions';

// ── Category icons (keyed by Arabic category name from permission-labels) ──────

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
  locale?: Locale;
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

export function PermissionPicker({ userId, userName, assigned, available, locale = 'ar' }: Props) {
  const m = uiT(locale).userPermissionsPage;
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
      <div className="sticky top-2 z-10 overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-[0_10px_30px_-18px_rgb(0_0_0/0.45)]">

        {/* Count row */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-400/50 text-brand-700 shrink-0 [&_svg]:h-4 [&_svg]:w-4">
              <ShieldCheck />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">{m.grantedTitle}</p>
              <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                <span className="font-bold text-brand-700">{assignedCount}</span>
                {' '}{m.ofLabel}{' '}
                <span className="font-medium text-slate-600">{allRows.length}</span>
                {' '}{m.permissionSuffix}
              </p>
            </div>
          </div>
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {m.savingLabel}
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
              placeholder={m.searchPlaceholder}
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
              {m.selectAllBtn}{matchUnassigned.length > 0 ? ` (${matchUnassigned.length})` : ''}
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
              {m.deselectAllBtn}{matchAssigned.length > 0 ? ` (${matchAssigned.length})` : ''}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Permission group cards ────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="bg-surface border border-hairline rounded-[22px] flex flex-col items-center justify-center py-16 gap-2.5">
          <ShieldCheck className="h-10 w-10 text-slate-200" />
          <p className="text-[13px] font-semibold text-slate-500">{m.noMatchTitle}</p>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[12px] text-brand-600 hover:underline mt-0.5"
            >
              {m.clearSearch}
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
            const groupLabel     = m.categoryNames[group] ?? group;

            return (
              <div
                key={group}
                className="bg-surface border border-hairline rounded-[22px] overflow-hidden"
              >
                {/* Group header */}
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/12 text-brand-700 shrink-0 [&_svg]:h-4 [&_svg]:w-4">
                      {icon}
                    </span>
                    <h3 className="font-heading text-[16px] font-bold text-slate-900">{groupLabel}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        allGranted
                          ? run([], rows.map((r) => r.code), null)
                          : run(rows.filter((r) => !r.assigned).map((r) => r.code), [], null)
                      }
                      className="rounded-full border border-hairline px-3 py-1 text-[11.5px] font-semibold text-slate-600 transition-colors hover:border-brand-500/40 hover:text-brand-700 disabled:opacity-50"
                    >
                      {allGranted ? m.deselectAllBtn : m.selectAllBtn}
                    </button>
                    <span
                    className={cn(
                      'inline-flex h-5 min-w-[40px] px-2 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                      allGranted  ? 'bg-emerald-500/12 text-emerald-600' :
                      someGranted ? 'bg-brand-500/12 text-brand-700' :
                                    'bg-slate-500/10 text-slate-500',
                    )}
                  >
                    {grantedInGroup}/{rows.length}
                  </span>
                  </div>
                </div>

                {/* Permission tiles: two to a line; the switch grants or revokes */}
                <ul className="grid grid-cols-1 gap-px bg-hairline md:grid-cols-2 [&>li:last-child:nth-child(odd)]:md:col-span-2">
                  {rows.map((row) => (
                    <li key={row.id} className="bg-surface">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.assigned}
                        aria-label={row.label}
                        title={row.code}
                        disabled={pending}
                        onClick={() => toggle(row)}
                        data-testid="permission-toggle"
                        className={cn(
                          'flex h-full w-full items-center gap-4 px-5 py-3.5 text-start transition-colors disabled:cursor-wait',
                          row.assigned ? 'bg-brand-500/[0.05] hover:bg-brand-500/[0.08]' : 'hover:bg-surface-muted/50',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-semibold leading-tight text-slate-900">{row.label}</span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight', PERMISSION_TYPE_CLS[row.type])}>
                              {row.type}
                            </span>
                          </span>
                          {row.desc && <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">{row.desc}</span>}
                        </span>
                        {busyCode === row.code ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                        ) : (
                          <span
                            aria-hidden
                            className={cn(
                              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                              row.assigned ? 'bg-brand-500' : 'bg-slate-400/30',
                            )}
                          >
                            <span
                              className={cn(
                                'absolute h-5 w-5 rounded-full bg-[#fff] shadow transition-all',
                                row.assigned ? 'start-[22px]' : 'start-0.5',
                              )}
                            />
                          </span>
                        )}
                      </button>
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
        {m.footerNotePrefix}{' '}
        <span className="font-medium text-slate-500">{userName}</span>
        {' '}{m.footerNoteSuffix}
      </p>

    </div>
  );
}
