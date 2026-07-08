import type { Href } from 'expo-router';

/** Strip trailing slashes and query strings for tab-route comparison. */
export function normalizeRoutePath(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path;
  const trimmed = withoutQuery.replace(/\/$/, '');
  return trimmed || '/';
}

/** Bottom-tab highlight for role hubs with Home + Tournaments stacks. */
export function roleHubActiveTabKey(
  pathname: string,
  roleRoot: string,
  tabs: readonly { key: string }[],
): string {
  const normalized = normalizeRoutePath(pathname);
  if (normalized === roleRoot) {
    return 'index';
  }
  if (
    normalized.startsWith(`${roleRoot}/tournament/`) ||
    normalized === `${roleRoot}/tournaments` ||
    normalized.startsWith(`${roleRoot}/tournaments/`)
  ) {
    return 'tournaments';
  }
  const segment = normalized.split('/').pop() ?? 'index';
  return tabs.some((tab) => tab.key === segment) ? segment : 'index';
}

export function hrefToPath(href: Href): string {
  if (typeof href === 'string') {
    return normalizeRoutePath(href);
  }
  return normalizeRoutePath(href.pathname);
}

/** Role hub prefix, e.g. `/club-manager/my-matches` → `/club-manager`. */
export function roleRootFromHref(href: Href): string {
  const path = hrefToPath(href);
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? `/${parts[0]}` : path;
}

function isRoleTabLandingPath(current: string, roleRoot: string): boolean {
  if (current === roleRoot) {
    return true;
  }
  if (!current.startsWith(`${roleRoot}/`)) {
    return false;
  }
  const remainder = current.slice(roleRoot.length + 1);
  return remainder.length > 0 && !remainder.includes('/');
}

type RoleTabRouter = {
  dismissAll: () => void;
  replace: (href: Href, options?: { withAnchor?: boolean }) => void;
};

/** Switch tabs within a role `(tabs)` group; dismiss stack overlays first when needed. */
export function navigateRoleTabGroup(
  router: RoleTabRouter,
  pathname: string,
  href: Href,
  isStackOverlayPath: (current: string) => boolean,
): void {
  const target = hrefToPath(href);
  const current = normalizeRoutePath(pathname);
  if (current === target) {
    return;
  }

  if (isStackOverlayPath(current)) {
    router.dismissAll();
  }

  router.replace(href, { withAnchor: false });
}

/** Generic role tab switch for roles that still embed the tab bar per-screen (legacy per-screen bars). */
export function navigateRoleTab(
  router: RoleTabRouter,
  currentPathname: string,
  href: Href,
): void {
  const target = hrefToPath(href);
  const current = normalizeRoutePath(currentPathname);
  if (current === target) {
    return;
  }

  const roleRoot = roleRootFromHref(href);

  if (!isRoleTabLandingPath(current, roleRoot)) {
    router.dismissAll();
  }

  router.replace(href, { withAnchor: false });
}
