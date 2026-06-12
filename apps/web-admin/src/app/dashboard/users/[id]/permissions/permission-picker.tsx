'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CheckCheck,
  X,
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

export function PermissionPicker({ userId, userName, assigned, available }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const allRows: Row[] = useMemo(() => {
    const rows: Row[] = [
      ...assigned.map((p) => ({ ...p, assigned: true })),
      ...available.map((p) => ({ ...p, assigned: false })),
    ].map((p) => {
      const meta = getPermissionMeta(p.code, p.description);
      return { ...p, assigned: p.assigned, label: meta.label, desc: meta.description, group: meta.category, type: meta.type };
    });
    return rows.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  }, [assigned, available]);

  const assignedCount = assigned.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
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
    else run([row.code], [], row.code);
  }

  const matchUnassigned = filtered.filter((r) => !r.assigned).map((r) => r.code);
  const matchAssigned   = filtered.filter((r) =>  r.assigned).map((r) => r.code);

  return (
    <div className="space-y-3">

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* ── Unified toolbar ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">

        {/* Top: count + saving indicator */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600 shrink-0" />
            <span className="text-sm text-slate-700">
              الصلاحيات الممنوحة:
              <span className="font-bold text-slate-900 tabular-nums mx-1">{assignedCount}</span>
              <span className="text-slate-400">/ {allRows.length}</span>
            </span>
          </div>
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-2xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              جارٍ الحفظ…
            </span>
          )}
        </div>

        {/* Bottom: search + bulk actions */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-surface-muted/30">
          <div className="flex-1 min-w-[200px]">
            <Input
              inputSize="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الوصف أو القسم أو الرمز…"
              leftAddon={<Search />}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
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

      {/* ── Permission groups ─────────────────────────────────────────────── */}
      <div className="max-h-[560px] overflow-y-auto scrollbar-thin rounded-xl ring-1 ring-inset ring-hairline divide-y divide-hairline">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-400">
            <ShieldCheck className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium text-slate-500">لا توجد صلاحيات مطابقة</p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-xs text-brand-600 hover:underline mt-1"
              >
                مسح البحث
              </button>
            )}
          </div>
        ) : (
          groups.map(([group, rows]) => {
            const grantedInGroup = rows.filter((r) => r.assigned).length;
            return (
              <div key={group}>
                {/* Group header */}
                <div className="sticky top-0 z-10 bg-surface-muted/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between border-b border-hairline">
                  <span className="text-xs font-semibold text-slate-700">{group}</span>
                  <span className="text-2xs font-medium text-slate-400 tabular-nums bg-surface rounded-full px-2 py-0.5">
                    {grantedInGroup}/{rows.length}
                  </span>
                </div>

                {/* Permission rows */}
                <ul className="divide-y divide-hairline">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <label
                        className={cn(
                          'flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors',
                          'hover:bg-slate-50',
                          row.assigned && 'bg-brand-50/30 hover:bg-brand-50/50',
                        )}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-hairline text-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:opacity-40 cursor-pointer"
                          checked={row.assigned}
                          disabled={pending}
                          onChange={() => toggle(row)}
                        />

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          {/* Name + type badge + busy spinner */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 leading-tight">
                              {row.label}
                            </span>
                            <span
                              className={cn(
                                'inline-block px-1.5 py-px rounded-full text-[10px] font-medium leading-tight shrink-0',
                                PERMISSION_TYPE_CLS[row.type],
                              )}
                            >
                              {row.type}
                            </span>
                            {busyCode === row.code && (
                              <Loader2 className="h-3 w-3 animate-spin text-slate-400 shrink-0" />
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-2xs text-slate-500 leading-snug mt-px">
                            {row.desc}
                          </p>

                          {/* Technical code */}
                          <p className="font-mono text-2xs text-slate-400 mt-px" dir="ltr">
                            {row.code}
                          </p>
                        </div>

                        {/* Granted indicator */}
                        {row.assigned && busyCode !== row.code && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success-500 shrink-0" />
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <p className="text-2xs text-slate-400 px-1">
        التغييرات تُحفظ فوراً عند التحديد أو الإلغاء. لا يؤثر ذلك على دور{' '}
        <span className="font-medium text-slate-500">{userName}</span> الأساسي.
      </p>
    </div>
  );
}
