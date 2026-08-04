import React, { useMemo, useState } from 'react';
import { Pagination } from './Pagination';
import { SkeletonRow } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  serverPagination?: ServerPagination;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 6,
  emptyState,
  onRowClick,
  pageSize,
  serverPagination,
  className = '',
}: DataTableProps<T>) {
  const [clientPage, setClientPage] = useState(1);

  const paged = useMemo(() => {
    if (serverPagination || !pageSize) return data;
    const start = (clientPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, clientPage, pageSize, serverPagination]);

  const showEmpty = !loading && data.length === 0;

  return (
    <div className={`overflow-hidden rounded-2xl border border-border-default bg-surface-card shadow-card ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-sunken">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-content-muted ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => <SkeletonRow key={i} columns={columns.length} />)}

            {!loading &&
              paged.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3.5 text-content-primary align-middle ${col.className || ''}`}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>

        {showEmpty && <div className="py-2">{emptyState}</div>}
      </div>

      {serverPagination && serverPagination.total > 0 && (
        <Pagination page={serverPagination.page} pageSize={serverPagination.pageSize} total={serverPagination.total} onPageChange={serverPagination.onPageChange} />
      )}
      {!serverPagination && pageSize && data.length > pageSize && (
        <Pagination page={clientPage} pageSize={pageSize} total={data.length} onPageChange={setClientPage} />
      )}
    </div>
  );
}
