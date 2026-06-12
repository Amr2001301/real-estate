'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const DATE_CLS =
  'h-8 w-full rounded-lg border border-hairline bg-white px-2.5 text-xs text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-xs transition-colors';

interface Props {
  defaultQ?: string;
  defaultAction?: string;
  defaultEntityType?: string;
  defaultActorId?: string;
  defaultFrom?: string;
  defaultTo?: string;
}

export function AuditFilterBar({
  defaultQ        = '',
  defaultAction   = '',
  defaultEntityType = '',
  defaultActorId  = '',
  defaultFrom     = '',
  defaultTo       = '',
}: Props) {
  const router = useRouter();

  const [q,          setQ]          = useState(defaultQ);
  const [action,     setAction]     = useState(defaultAction);
  const [entityType, setEntityType] = useState(defaultEntityType);
  const [actorId,    setActorId]    = useState(defaultActorId);
  const [from,       setFrom]       = useState(defaultFrom);
  const [to,         setTo]         = useState(defaultTo);

  // Open advanced panel automatically if any advanced field already has a value.
  const [showAdvanced, setShowAdvanced] = useState(
    !!(defaultEntityType || defaultActorId || defaultFrom || defaultTo),
  );

  const hasAdvanced = !!(entityType || actorId || from || to);
  const hasAny      = !!(q || action || entityType || actorId || from || to);

  function buildQuery(): string {
    const p = new URLSearchParams();
    if (q)          p.set('q', q);
    if (action)     p.set('action', action);
    if (entityType) p.set('entityType', entityType);
    if (actorId)    p.set('actorId', actorId);
    if (from)       p.set('from', from);
    if (to)         p.set('to', to);
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/dashboard/audit-logs${buildQuery()}`);
  }

  function handleClear() {
    setQ(''); setAction(''); setEntityType(''); setActorId(''); setFrom(''); setTo('');
    router.push('/dashboard/audit-logs');
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
      <form onSubmit={handleSubmit}>

        {/* ── Main row (always visible) ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {/* General search */}
          <div className="flex-1 min-w-[180px]">
            <Input
              inputSize="sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث: اسم مستخدم، إجراء، IP..."
              leftAddon={<Search />}
            />
          </div>

          {/* Action method */}
          <Select
            inputSize="sm"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-44 shrink-0"
            aria-label="الإجراء"
          >
            <option value="">كل الإجراءات</option>
            <option value="POST">POST — إنشاء</option>
            <option value="PATCH">PATCH — تعديل</option>
            <option value="PUT">PUT — تحديث</option>
            <option value="DELETE">DELETE — حذف</option>
          </Select>

          <span className="h-5 w-px bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Apply + clear */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button type="submit" variant="primary" size="sm">تطبيق</Button>
            {hasAny && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>مسح</Button>
            )}
          </div>

          <span className="h-5 w-px bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 text-xs font-medium shrink-0 transition-colors',
              showAdvanced ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showAdvanced ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
            {hasAdvanced && !showAdvanced && (
              <span className="inline-flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                !
              </span>
            )}
          </button>
        </div>

        {/* ── Advanced panel (expands inside same card) ─────────────────── */}
        {showAdvanced && (
          <div className="border-t border-hairline bg-surface-muted/30 px-4 py-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">المساحة</label>
                <Input
                  inputSize="sm"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  placeholder="users، auth، reservations…"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">من تاريخ</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={DATE_CLS}
                  aria-label="من تاريخ"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">إلى تاريخ</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={DATE_CLS}
                  aria-label="إلى تاريخ"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                <label className="text-[11px] font-medium text-slate-400">معرّف المستخدم (UUID)</label>
                <Input
                  inputSize="sm"
                  value={actorId}
                  onChange={(e) => setActorId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-…"
                  dir="ltr"
                />
              </div>

            </div>
          </div>
        )}

      </form>
    </div>
  );
}
