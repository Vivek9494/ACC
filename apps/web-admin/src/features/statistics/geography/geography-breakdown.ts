import type { AdminUsersByGeographyProvince } from '@acc/types';

export type GeographySort = 'users' | 'name';

export interface GeographyTotals {
  users: number;
  provinces: number;
  centers: number;
}

export function geographyTotals(provinces: readonly AdminUsersByGeographyProvince[]): GeographyTotals {
  let users = 0;
  let centers = 0;
  for (const province of provinces) {
    for (const center of province.centers) {
      users += center.userCount;
      centers += 1;
    }
  }
  return { users, provinces: provinces.length, centers };
}

/**
 * A province name match keeps all its centers; otherwise only matching centers
 * remain. Province counts are re-summed from the centers left visible.
 */
export function filterGeography(
  provinces: readonly AdminUsersByGeographyProvince[],
  search: string,
): AdminUsersByGeographyProvince[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...provinces];
  return provinces.flatMap((province) => {
    if (province.name.toLowerCase().includes(needle)) return [province];
    const centers = province.centers.filter((c) => c.name.toLowerCase().includes(needle));
    if (centers.length === 0) return [];
    return [{ ...province, centers, userCount: centers.reduce((sum, c) => sum + c.userCount, 0) }];
  });
}

export function sortGeography(
  provinces: readonly AdminUsersByGeographyProvince[],
  sort: GeographySort,
): AdminUsersByGeographyProvince[] {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const byUsers = (a: { name: string; userCount: number }, b: { name: string; userCount: number }) =>
    b.userCount - a.userCount || byName(a, b);
  const compare = sort === 'users' ? byUsers : byName;
  return [...provinces].sort(compare).map((p) => ({ ...p, centers: [...p.centers].sort(compare) }));
}

/** Share of `total` as a 0–100 percentage with one decimal. */
export function sharePercent(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}
