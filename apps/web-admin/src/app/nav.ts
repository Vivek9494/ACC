import { UserRole } from '@acc/types';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  MapPinned,
  Megaphone,
  MonitorPlay,
  ScrollText,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** One-line purpose shown on stub pages and as the page subtitle. */
  description: string;
  /** False until the area ships (later phases) — renders a stub page. */
  available: boolean;
  /** Restricts the area to these platform roles (mirrors the API permission); all dashboard roles when unset. */
  roles?: readonly UserRole[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: '/statistics',
    label: 'Statistics',
    icon: BarChart3,
    description: 'OTP analytics, users by geography and tournament leaderboards.',
    available: true,
  },
  {
    path: '/tournaments',
    label: 'Tournaments',
    icon: Trophy,
    description: 'Every ACC, APL and Center-level tournament.',
    available: true,
  },
  {
    path: '/users',
    label: 'Users',
    icon: Users,
    description: 'Accounts, platform roles and access.',
    available: true,
  },
  {
    path: '/geography',
    label: 'Geography',
    icon: MapPinned,
    description: 'Tournament types, provinces and centers.',
    available: true,
    roles: [UserRole.Admin],
  },
  {
    path: '/verification',
    label: 'Verification',
    icon: BadgeCheck,
    description: 'Player verification and tournament registrations.',
    available: true,
  },
  {
    path: '/broadcast',
    label: 'Broadcast',
    icon: Megaphone,
    description: 'Announcement banner shown on every signed-in dashboard for 24 hours.',
    available: true,
  },
  {
    path: '/overlay',
    label: 'Overlay',
    icon: MonitorPlay,
    description: 'Broadcast overlay themes — one HTML graphic per overlay control.',
    available: true,
    roles: [UserRole.Admin],
  },
  {
    path: '/rulebook',
    label: 'Rulebook',
    icon: BookOpen,
    description: 'Business rules the platform enforces, by area.',
    available: true,
    roles: [UserRole.Admin, UserRole.ClubManager],
  },
  {
    path: '/logs',
    label: 'Logs',
    icon: ScrollText,
    description: 'Audit log of who did what, and when.',
    available: true,
    roles: [UserRole.Admin],
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Your account and platform configuration.',
    available: true,
  },
];

export const DEFAULT_ROUTE = '/tournaments';

export function canOpenNavItem(item: Pick<NavItem, 'roles'>, role: UserRole): boolean {
  return !item.roles || item.roles.includes(role);
}

export function navItemsFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => canOpenNavItem(item, role));
}

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
}
