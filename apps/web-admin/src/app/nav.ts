import {
  BadgeCheck,
  BarChart3,
  MapPinned,
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
    description: 'Provinces, cities and centers.',
    available: false,
  },
  {
    path: '/verification',
    label: 'Verification',
    icon: BadgeCheck,
    description: 'Player verification and tournament registrations.',
    available: true,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Platform configuration.',
    available: false,
  },
];

export const DEFAULT_ROUTE = '/tournaments';

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
}
