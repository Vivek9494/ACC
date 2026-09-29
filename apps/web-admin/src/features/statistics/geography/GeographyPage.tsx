import { Building2, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Map as MapIcon, RefreshCw, Search, Users } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { useUsersByGeography } from './geography-api';
import {
  filterGeography,
  geographyTotals,
  sharePercent,
  sortGeography,
  type GeographySort,
} from './geography-breakdown';

function ShareBar({ percent }: { percent: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-12 text-right text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  );
}

/** Admin: non-deleted users by province → center (expandable rows). */
export function GeographyPage(): React.ReactElement {
  const query = useUsersByGeography();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<GeographySort>('users');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const provinces = useMemo(() => query.data?.provinces ?? [], [query.data]);
  const totals = useMemo(() => geographyTotals(provinces), [provinces]);
  const rows = useMemo(() => sortGeography(filterGeography(provinces, search), sort), [provinces, search, sort]);
  const visibleUsers = rows.reduce((sum, p) => sum + p.userCount, 0);
  const searching = search.trim() !== '';
  const stat = (n: number): number | string => (query.isPending ? '—' : n);

  const toggle = (provinceId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(provinceId)) next.delete(provinceId);
      else next.add(provinceId);
      return next;
    });
  const isOpen = (provinceId: string) => searching || expanded.has(provinceId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={stat(totals.users)} icon={Users} accent="bg-primary/15 text-primary" />
        <StatCard label="Provinces" value={stat(totals.provinces)} icon={MapIcon} accent="bg-secondary/10 text-secondary" />
        <StatCard label="Centers" value={stat(totals.centers)} icon={Building2} accent="bg-secondary/10 text-secondary" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search province or center"
            className="pl-9"
            aria-label="Search province or center"
          />
        </div>
        <SegmentedControl
          ariaLabel="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'users', label: 'Most users' },
            { value: 'name', label: 'A–Z' },
          ]}
        />
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            disabled={searching}
            onClick={() => setExpanded(new Set(provinces.map((p) => p.provinceId)))}
          >
            <ChevronsUpDown />
            Expand all
          </Button>
          <Button variant="outline" disabled={searching} onClick={() => setExpanded(new Set())}>
            <ChevronsDownUp />
            Collapse all
          </Button>
          <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      {query.isError ? (
        <QueryErrorCard title="Couldn't load the geography breakdown" error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Province / Center</TableHead>
                <TableHead className="text-right">Centers</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead>Share of all users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending ? (
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {Array.from({ length: 4 }, (_c, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-16 text-center text-muted-foreground">
                    {searching ? 'No provinces or centers match this search.' : 'No provinces have been created yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((province) => {
                  const open = isOpen(province.provinceId);
                  return (
                    <Fragment key={province.provinceId}>
                      <TableRow className="cursor-pointer bg-muted/20" onClick={() => toggle(province.provinceId)}>
                        <TableCell>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 font-semibold text-secondary"
                            aria-expanded={open}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(province.provinceId);
                            }}
                          >
                            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            {province.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{province.centers.length}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{province.userCount}</TableCell>
                        <TableCell>
                          <ShareBar percent={sharePercent(province.userCount, totals.users)} />
                        </TableCell>
                      </TableRow>
                      {open
                        ? province.centers.map((center) => (
                            <TableRow key={center.centerId}>
                              <TableCell className="pl-12">
                                <span className={cn(center.userCount === 0 && 'text-muted-foreground')}>{center.name}</span>
                              </TableCell>
                              <TableCell />
                              <TableCell
                                className={cn('text-right tabular-nums', center.userCount === 0 && 'text-muted-foreground')}
                              >
                                {center.userCount}
                              </TableCell>
                              <TableCell>
                                <ShareBar percent={sharePercent(center.userCount, totals.users)} />
                              </TableCell>
                            </TableRow>
                          ))
                        : null}
                    </Fragment>
                  );
                })
              )}
              {!query.isPending && rows.length > 0 ? (
                <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell>{searching ? 'Matching total' : 'Total'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rows.reduce((sum, p) => sum + p.centers.length, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{visibleUsers}</TableCell>
                  <TableCell>
                    <ShareBar percent={sharePercent(visibleUsers, totals.users)} />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
