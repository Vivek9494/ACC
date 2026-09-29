import { canViewAdminAnalytics, type UserRole } from '@acc/types';
import { KeyRound, MapPinned, Trophy, type LucideIcon } from 'lucide-react';

export interface StatisticsSection {
  /** Route segment under /statistics. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Mirrors the server permission so hidden tabs match what the api would reject. */
  visibleTo: (role: UserRole) => boolean;
}

export const STATISTICS_SECTIONS: readonly StatisticsSection[] = [
  { path: 'otp', label: 'OTP analytics', icon: KeyRound, visibleTo: canViewAdminAnalytics },
  { path: 'geography', label: 'Geography', icon: MapPinned, visibleTo: canViewAdminAnalytics },
  { path: 'tournaments', label: 'Tournament stats', icon: Trophy, visibleTo: () => true },
];

export function statisticsSectionsFor(role: UserRole): StatisticsSection[] {
  return STATISTICS_SECTIONS.filter((section) => section.visibleTo(role));
}
