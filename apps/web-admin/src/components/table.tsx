import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  rowKey: (row: T) => string;
  header?: ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = 'لا توجد بيانات', header }: Props<T>) {
  return (
    <div className="bg-white rounded-2xl border border-hairline shadow-xs overflow-hidden">
      {header && (
        <div className="px-4 py-3 border-b border-hairline">
          {header}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`text-right px-4 py-2.5 font-medium whitespace-nowrap ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50/60 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 align-middle ${col.className ?? ''}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
