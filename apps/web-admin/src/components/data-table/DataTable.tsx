import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const DATA_TABLE_PAGE_SIZES = [10, 25, 50] as const;

/**
 * Server-driven paging (cursor or offset APIs): the parent owns the page and
 * fetches it; the table only renders `data` (the current page) and the footer.
 */
export interface ServerPagination {
  pageIndex: number;
  pageSize: number;
  /** Rows matching the current filters across all pages. */
  totalCount: number;
  hasNextPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Dims rows while a new page loads over the previous one. */
  isFetching?: boolean;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  /** Rendered in place of rows when there is nothing to show. */
  emptyState?: ReactNode;
  initialSorting?: SortingState;
  /** Client mode: reset to page 1 whenever this changes (e.g. serialized filters). */
  resetPageKey?: string;
  getRowId?: (row: TData) => string;
  /** Makes each row a link-like target (click or Enter). */
  onRowClick?: (row: TData) => void;
  /** Switches to server paging; column sorting is disabled (the API owns the order). */
  serverPagination?: ServerPagination;
}

/**
 * Dashboard data table (TanStack Table): header sorting, client or server
 * pagination, loading skeleton and empty state. Reference pattern for list screens.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyState,
  initialSorting = [],
  resetPageKey,
  getRowId,
  onRowClick,
  serverPagination: server,
}: DataTableProps<TData>): React.ReactElement {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [clientPagination, setClientPagination] = useState({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    setClientPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [resetPageKey]);

  const table = useReactTable({
    data,
    columns,
    state: server ? {} : { sorting, pagination: clientPagination },
    onSortingChange: setSorting,
    onPaginationChange: setClientPagination,
    enableSorting: !server,
    manualPagination: Boolean(server),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: server ? undefined : getSortedRowModel(),
    getPaginationRowModel: server ? undefined : getPaginationRowModel(),
    getRowId,
  });

  const total = server ? server.totalCount : data.length;
  const pageIndex = server ? server.pageIndex : clientPagination.pageIndex;
  const pageSize = server ? server.pageSize : clientPagination.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = server ? pageIndex * pageSize + data.length : Math.min(total, (pageIndex + 1) * pageSize);
  const canPrevious = server ? pageIndex > 0 : table.getCanPreviousPage();
  const canNext = server ? server.hasNextPage : table.getCanNextPage();
  const rows = table.getRowModel().rows;

  const changePageSize = (size: number) => {
    if (server) server.onPageSizeChange(size);
    else setClientPagination({ pageIndex: 0, pageSize: size });
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const label = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableHead key={header.id} className={header.column.columnDef.meta?.headerClassName}>
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                      >
                        {label}
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className={cn(server?.isFetching && !isLoading && 'opacity-60 transition-opacity')}>
          {isLoading ? (
            Array.from({ length: 6 }, (_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                {columns.map((_col, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-16 text-center text-muted-foreground">
                {emptyState ?? 'No results.'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                {...(onRowClick
                  ? {
                      role: 'link',
                      tabIndex: 0,
                      className: 'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none',
                      onClick: () => onRowClick(row.original),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter') onRowClick(row.original);
                      },
                    }
                  : {})}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
        <p className="text-muted-foreground">
          {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => changePageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TABLE_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn('mr-2 text-muted-foreground', total === 0 && 'invisible')}>
              Page {pageIndex + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => (server ? server.onPreviousPage() : table.previousPage())}
              disabled={!canPrevious || isLoading}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => (server ? server.onNextPage() : table.nextPage())}
              disabled={!canNext || isLoading || Boolean(server?.isFetching)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
