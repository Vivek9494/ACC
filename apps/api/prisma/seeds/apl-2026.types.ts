/** Normalized APL 2026 seed payload (Phase 1 output / Phase 2 input). */
export interface Apl2026SeedData {
  tournament: {
    name: string;
    ballType: 'TENNIS';
    year: number;
  };
  teams: Apl2026SeedTeam[];
}

export interface Apl2026SeedTeam {
  sourceId: string;
  name: string;
  players: Apl2026SeedPlayer[];
}

export interface Apl2026SeedPlayer {
  sourceId: string;
  name: string;
  role: 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | null;
  phone: string | null;
  /** True when phone was synthesized from sourceId (null in export). */
  phoneIsSentinel: boolean;
  center: string | null;
  battingRating: number | null;
  bowlingRating: number | null;
  fieldingRating: number | null;
}

export const APL_2026_TEAM_EXPORT_URLS: readonly string[] = [
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww000boie2y1mq1j8i',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0002oie2lu90qo4n',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0000oie2goe9e5kt',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0001oie254fyz5ws',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0003oie2exbh0tln',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0004oie2u5kls2rj',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0005oie2chmsyvyc',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0006oie25nifusyb',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0007oie2k4s8c179',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0008oie27jvklx5c',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww0009oie2djicffhr',
  'https://www.atmiyasportsclub.com/api/proxy/export/teams/cmoyv79ww000coie2fchqj112',
] as const;

export const APL_2026_SEED_JSON_PATH = 'prisma/seed-data/apl-2026.json';
