import { api, safe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { DataTable } from '@/components/table';

interface AuditLog {
  id: string;
  actorId: string | null;
  actor?: { id: string; fullName: string; role: string };
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export default async function AuditPage() {
  const r = await safe(api.get<Paged<AuditLog>>('/audit-logs?pageSize=100'));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">سجل التدقيق</h1>

      {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{r.error}</div>}

      {r.data && (
        <DataTable
          rowKey={(l) => l.id}
          rows={r.data.data}
          emptyMessage="لا توجد سجلات"
          columns={[
            { key: 'when', header: 'التوقيت', cell: (l) => <span className="text-xs">{formatDateTime(l.createdAt)}</span> },
            { key: 'actor', header: 'المنفذ', cell: (l) => l.actor?.fullName ?? '— نظام —' },
            { key: 'role', header: 'الدور', cell: (l) => <span className="text-xs font-mono text-gray-500">{l.actor?.role ?? '—'}</span> },
            { key: 'action', header: 'العملية', cell: (l) => <span className="text-xs font-mono">{l.action}</span> },
            { key: 'entity', header: 'الكيان', cell: (l) => <span className="text-xs">{l.entityType}</span> },
            { key: 'id', header: 'المعرّف', cell: (l) => <span className="text-xs font-mono text-gray-500">{l.entityId?.slice(0, 8) ?? '—'}</span> },
            { key: 'ip', header: 'IP', cell: (l) => <span className="text-xs" dir="ltr">{l.ip ?? '—'}</span> },
          ]}
        />
      )}
    </div>
  );
}
