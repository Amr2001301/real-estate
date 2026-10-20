'use client';

import type { ReactNode } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ShieldCheck, AlertCircle, Loader2, Check,
  CheckCheck, X, TrendingUp, Calendar, Bookmark, FileText,
  CreditCard, Wrench, BarChart3, Lock, LayoutGrid, Award,
  CircleDollarSign, Users as UsersIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
  const [section, setSection]   = useState('');
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

  // Every section (for the filter), then the one picked.
  const allGroups = useMemo(() => {
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
  const groups = section ? allGroups.filter(([g]) => g === section) : allGroups;
  const visible = groups.flatMap(([, rows]) => rows);

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

  const matchUnassigned = visible.filter((r) => !r.assigned).map((r) => r.code);
  const matchAssigned   = visible.filter((r) =>  r.assigned).map((r) => r.code);

  return (
    <div className="flex flex-col gap-5">

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* ── Toolbar: search, bulk actions, a chip per section ─────────────── */}
      <div className="sticky top-2 z-10 rounded-[22px] border border-hairline bg-surface/95 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.55)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
          <div className="min-w-[220px] flex-1">
            <Input
              inputSize="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.searchPlaceholder}
              leftAddon={<Search />}
            />
          </div>
          <Select
            inputSize="sm"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            aria-label={m.sectionFilter}
            className="w-52 shrink-0"
            data-testid="permission-section-filter"
          >
            <option value="">{m.allSections}</option>
            {allGroups.map(([group, rows]) => (
              <option key={group} value={group}>
                {m.categoryNames[group] ?? group} ({rows.filter((r) => r.assigned).length}/{rows.length})
              </option>
            ))}
          </Select>
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {m.savingLabel}
            </span>
          )}
          <button
            type="button"
            disabled={pending || matchUnassigned.length === 0}
            onClick={() => run(matchUnassigned, [], null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-[12.5px] font-bold text-[#1a1408] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {m.selectAllBtn}{matchUnassigned.length > 0 ? ` (${matchUnassigned.length})` : ''}
          </button>
          <button
            type="button"
            disabled={pending || matchAssigned.length === 0}
            onClick={() => run([], matchAssigned, null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-4 text-[12.5px] font-semibold text-danger-600 transition-colors hover:border-danger-500/40 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
            {m.deselectAllBtn}{matchAssigned.length > 0 ? ` (${matchAssigned.length})` : ''}
          </button>
        </div>
      </div>

      {/* ── Sections ──────────────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-[22px] border border-hairline bg-surface py-16">
          <ShieldCheck className="h-10 w-10 text-slate-300" />
          <p className="text-[13px] font-semibold text-slate-500">{m.noMatchTitle}</p>
          {query && (
            <button type="button" onClick={() => setQuery('')} className="mt-0.5 text-[12px] text-brand-600 hover:underline">
              {m.clearSearch}
            </button>
          )}
        </div>
      ) : (
        groups.map(([group, rows]) => {
          const granted = rows.filter((r) => r.assigned).length;
          const allGranted = granted === rows.length;
          const icon = CATEGORY_ICON[group] ?? <ShieldCheck />;
          return (
            <section
              key={group}
              id={`perm-${group}`}
              className="scroll-mt-40 overflow-hidden rounded-[24px] border border-hairline bg-surface"
            >
              <header className="flex flex-wrap items-center gap-4 px-6 pb-4 pt-5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/25 to-brand-600/10 text-brand-700 ring-1 ring-inset ring-brand-500/25 [&_svg]:h-5 [&_svg]:w-5">
                  {icon}
                </span>
                <div className="min-w-[160px] flex-1">
                  <h3 className="font-heading text-[18px] font-bold text-slate-900">{m.categoryNames[group] ?? group}</h3>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-gradient-to-l from-brand-400 to-brand-600" style={{ width: `${(granted / rows.length) * 100}%` }} />
                    </div>
                    <span className="text-[12px] text-slate-500 tabular-nums">{granted}/{rows.length}</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    allGranted
                      ? run([], rows.map((r) => r.code), null)
                      : run(rows.filter((r) => !r.assigned).map((r) => r.code), [], null)
                  }
                  className="rounded-full border border-hairline px-3.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-brand-500/40 hover:text-brand-700 disabled:opacity-50"
                >
                  {allGranted ? m.deselectAllBtn : m.selectAllBtn}
                </button>
              </header>

              <ul className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-2">
                {rows.map((row) => (
                  <li key={row.id}>
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
                        'group flex h-full w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-start transition-all disabled:cursor-wait',
                        row.assigned
                          ? 'border-brand-500/45 bg-gradient-to-bl from-brand-500/[0.10] to-transparent shadow-[0_8px_24px_-16px] shadow-brand-500/60'
                          : 'border-hairline hover:-translate-y-px hover:border-brand-500/30',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={cn('text-[13.5px] font-semibold leading-tight', row.assigned ? 'text-slate-900' : 'text-slate-700')}>{row.label}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight', PERMISSION_TYPE_CLS[row.type])}>
                            {row.type}
                          </span>
                        </span>
                        {row.desc && <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">{row.desc}</span>}
                      </span>
                      {busyCode === row.code ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-400" />
                      ) : (
                        <span
                          aria-hidden
                          className={cn(
                            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                            row.assigned
                              ? 'border-brand-500 bg-brand-500 text-[#1a1408]'
                              : 'border-hairline text-transparent group-hover:border-brand-500/40',
                          )}
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <p className="px-1 text-[11.5px] text-slate-500">
        {m.footerNotePrefix} <span className="font-medium text-slate-600">{userName}</span> {m.footerNoteSuffix}
      </p>
    </div>
  );
}
