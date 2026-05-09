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
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = 'لا توجد بيانات' }: Props<T>) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`text-right p-3 font-medium ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-gray-100 hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className={`p-3 align-middle ${col.className ?? ''}`}>
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
