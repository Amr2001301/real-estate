'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// Display order index for category sections.
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
  // Track the code currently toggling so we can show a spinner on its row.
  const [busyCode, setBusyCode] = useState<string | null>(null);

  // Merge into one list with an `assigned` flag, sorted by code.
  const allRows: Row[] = useMemo(() => {
    const rows: Row[] = [
      ...assigned.map((p) => ({ ...p, assigned: true })),
      ...available.map((p) => ({ ...p, assigned: false })),
    ].map((p) => {
      const meta = getPermissionMeta(p.code, p.description);
      return {
        ...p,
        assigned: p.assigned,
        label: meta.label,
        desc: meta.description,
        group: meta.category,
        type: meta.type,
      };
    });
    return rows.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  }, [assigned, available]);

  const assignedCount = assigned.length;

  // Filter by code, description, Arabic label, or module group name.
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

  // Group filtered rows by business category, in the canonical display order.
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
      if (result.error) {
        setError(result.error);
        return;
      }
      // Re-fetch server data so assigned/available reflect the change.
      router.refresh();
    });
  }

  function toggle(row: Row) {
    if (row.assigned) run([], [row.code], row.code);
    else run([row.code], [], row.code);
  }

  // Bulk over the CURRENT search results only.
  const matchUnassigned = filtered.filter((r) => !r.assigned).map((r) => r.code);
  const matchAssigned = filtered.filter((r) => r.assigned).map((r) => r.code);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <span className="text-sm text-slate-700">
            الصلاحيات الممنوحة:{' '}
            <span className="font-bold text-slate-900 tabular-nums">{assignedCount}</span>
            <span className="text-slate-400"> / {allRows.length}</span>
          </span>
        </div>
        {pending && (
          <span className="inline-flex items-center gap-1.5 text-2xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            جارٍ الحفظ…
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Search + bulk over results */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px]">
          <Input
            inputSize="sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الوصف أو القسم أو الرمز..."
            leftAddon={<Search />}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || matchUnassigned.length === 0}
          onClick={() => run(matchUnassigned, [], null)}
        >
          تحديد كل نتائج البحث
          {matchUnassigned.length > 0 ? ` (${matchUnassigned.length})` : ''}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || matchAssigned.length === 0}
          onClick={() => run([], matchAssigned, null)}
          className="text-danger-700 hover:bg-danger-50"
        >
          إلغاء كل نتائج البحث
          {matchAssigned.length > 0 ? ` (${matchAssigned.length})` : ''}
        </Button>
      </div>

      {/* Grouped scrollable list */}
      <div className="max-h-[460px] overflow-y-auto scrollbar-thin rounded-xl ring-1 ring-inset ring-hairline divide-y divide-hairline">
        {groups.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-12">
            لا توجد صلاحيات مطابقة
          </p>
        ) : (
          groups.map(([group, rows]) => (
            <div key={group}>
              <div className="sticky top-0 z-10 bg-surface-muted/90 backdrop-blur px-4 py-1.5 flex items-center justify-between">
                <span className="text-2xs font-semibold text-slate-600">{group}</span>
                <span className="text-2xs text-slate-400 tabular-nums">
                  {rows.filter((r) => r.assigned).length}/{rows.length}
                </span>
              </div>
              <ul className="divide-y divide-hairline">
                {rows.map((row) => (
                  <li key={row.id}>
                    <label
                      className={cn(
                        'flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-surface-muted/40',
                        row.assigned && 'bg-brand-50/30',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded-md border-hairline text-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:opacity-50"
                        checked={row.assigned}
                        disabled={pending}
                        onChange={() => toggle(row)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{row.label}</span>
                          <span
                            className={cn(
                              'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium leading-tight',
                              PERMISSION_TYPE_CLS[row.type],
                            )}
                          >
                            {row.type}
                          </span>
                          {busyCode === row.code && (
                            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                          )}
                          {row.assigned && busyCode !== row.code && (
                            <Badge tone="success" variant="soft" size="sm">
                              ممنوحة
                            </Badge>
                          )}
                        </div>
                        <p className="text-2xs text-slate-500 mt-0.5">{row.desc}</p>
                        <p className="font-mono text-2xs text-slate-400 mt-1" dir="ltr">{row.code}</p>
                      </div>
                      {row.assigned && (
                        <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0 mt-0.5" />
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <p className="text-2xs text-slate-400">
        تُحفظ التغييرات فوراً عند التحديد أو الإلغاء. لا يؤثر ذلك على دور{' '}
        {userName} الأساسي.
      </p>
    </div>
  );
}
