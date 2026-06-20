/**
 * ACC Application — Team & Player seed data
 * Source: roster photo (ACC-3, ACC-6, ACC-9, ACC-0).
 *
 * Mapping rules applied:
 *  - Captain / VC / MGR  -> role designation, squadNumber = null
 *  - Rows 4..15          -> role PLAYER, squadNumber = the number on the sheet
 *  - SUB rows            -> role SUBSTITUTE
 *  - SCORER rows         -> treated as SUBSTITUTE (per request)
 *  - Parenthetical tags (JAMAI / PEI / WK / BRM / KK ...) are kept inside `name`
 *    because they disambiguate players who share a name.
 *
 * This file is pure data with no Prisma import, so it is safe to consume from a
 * seed script, a test factory, or an API import endpoint.
 */

export type SquadRole =
  | 'CAPTAIN'
  | 'VICE_CAPTAIN'
  | 'MANAGER'
  | 'PLAYER'
  | 'SUBSTITUTE';

export interface SeedPlayer {
  /** Name exactly as written on the roster, including any disambiguating tag. */
  name: string;
  role: SquadRole;
  /** Roster number from the sheet (4..15). null for C/VC/MGR and bench players. */
  squadNumber: number | null;
}

export interface SeedTeam {
  name: string;
  shortName: string;
  players: SeedPlayer[];
}

export const accTeams: SeedTeam[] = [
  {
    name: 'ACC-3',
    shortName: 'ACC3',
    players: [
      { name: 'AMRISH TANNA', role: 'CAPTAIN', squadNumber: null },
      { name: 'DEVASHISH SONI', role: 'VICE_CAPTAIN', squadNumber: null },
      { name: 'SAHISH PATEL', role: 'MANAGER', squadNumber: null },
      { name: 'MARGESH SHAH', role: 'PLAYER', squadNumber: 4 },
      { name: 'ANAND PATEL', role: 'PLAYER', squadNumber: 5 },
      { name: 'SHRIDEV RAVAL', role: 'PLAYER', squadNumber: 6 },
      { name: 'NIRAV PATEL', role: 'PLAYER', squadNumber: 7 },
      { name: 'HARDIK PATEL (JAMAI)', role: 'PLAYER', squadNumber: 8 },
      { name: 'GAGAN THAKKAR', role: 'PLAYER', squadNumber: 9 },
      { name: 'NIRMAL PATEL', role: 'PLAYER', squadNumber: 10 },
      { name: 'RONAK PATEL (PEI)', role: 'PLAYER', squadNumber: 11 },
      { name: 'PUJAN PATEL', role: 'PLAYER', squadNumber: 12 },
      { name: 'SAURABH PATEL', role: 'PLAYER', squadNumber: 13 },
      { name: 'MANAN THAKKAR', role: 'PLAYER', squadNumber: 14 },
      { name: 'NITIN PATEL (DUBAI)', role: 'PLAYER', squadNumber: 15 },
      { name: 'HARDIK PATEL (MUCHO)', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'UMANG RAMANI', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'RIKIN GAJJAR', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'DHARMIK PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'JINKAL PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'YASH DAVE', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'ABHISHEK PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'SHANTANU PARAB', role: 'SUBSTITUTE', squadNumber: null },
      // Scorers -> substitutes
      { name: 'APURVA PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'VIJAY PANCHAL', role: 'SUBSTITUTE', squadNumber: null },
    ],
  },
  {
    name: 'ACC-6',
    shortName: 'ACC6',
    players: [
      { name: 'SANTOSH VYDYULA', role: 'CAPTAIN', squadNumber: null },
      { name: 'TAPAN JADAV', role: 'VICE_CAPTAIN', squadNumber: null },
      { name: 'AMIT JIVANI', role: 'MANAGER', squadNumber: null },
      { name: 'MAYANK JAGAWAT', role: 'PLAYER', squadNumber: 4 },
      { name: 'ROMIL DALWADI', role: 'PLAYER', squadNumber: 5 },
      { name: 'JAY PATEL', role: 'PLAYER', squadNumber: 6 },
      { name: 'NIKHIL MISTRY', role: 'PLAYER', squadNumber: 7 },
      { name: 'NIRAJ PATEL', role: 'PLAYER', squadNumber: 8 },
      { name: 'PUNEET THAKKAR', role: 'PLAYER', squadNumber: 9 },
      { name: 'DIVYAM PATEL', role: 'PLAYER', squadNumber: 10 },
      { name: 'KRUPESH PATEL (WK)', role: 'PLAYER', squadNumber: 11 },
      { name: 'SACHIN KANOJIYA', role: 'PLAYER', squadNumber: 12 },
      { name: 'ASHISH KADAVLA', role: 'PLAYER', squadNumber: 13 },
      { name: 'HIRAL PATEL', role: 'PLAYER', squadNumber: 14 },
      { name: 'PIYUSH TANNA', role: 'PLAYER', squadNumber: 15 },
      { name: 'HARDIK PATEL (SHEL)', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'KASHYAP HAJARIWALA', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'YASH GANDHI (BRM)', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'ATIT PATEL (HAM)', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'SILEN PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'AMIT GHELANI', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'SMIT SHAH', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'DIVY PATEL', role: 'SUBSTITUTE', squadNumber: null },
      // No scorers listed for ACC-6
    ],
  },
  {
    name: 'ACC-9',
    shortName: 'ACC9',
    players: [
      { name: 'ALOKIK JOSHI', role: 'CAPTAIN', squadNumber: null },
      { name: 'KRUNAL MALAVIYA', role: 'VICE_CAPTAIN', squadNumber: null },
      { name: 'SAHISHNU SHAH', role: 'MANAGER', squadNumber: null },
      { name: 'BRIJESH UPADHYAY', role: 'PLAYER', squadNumber: 4 },
      { name: 'MILAN RADADIYA', role: 'PLAYER', squadNumber: 5 },
      { name: 'DARSHAN RAJ', role: 'PLAYER', squadNumber: 6 },
      { name: 'SHIVAM PATEL', role: 'PLAYER', squadNumber: 7 },
      { name: 'KUNJ PATEL', role: 'PLAYER', squadNumber: 8 },
      { name: 'TIRTH PATEL (NY)', role: 'PLAYER', squadNumber: 9 },
      { name: 'MEET SONANI', role: 'PLAYER', squadNumber: 10 },
      { name: 'HARDIK SUTHAR', role: 'PLAYER', squadNumber: 11 },
      { name: 'NISARG PATEL', role: 'PLAYER', squadNumber: 12 },
      { name: 'DEVANG PRAJAPATI', role: 'PLAYER', squadNumber: 13 },
      { name: 'VIVEK BHATT', role: 'PLAYER', squadNumber: 14 },
      { name: 'KISHAN (SUNNY) PATEL', role: 'PLAYER', squadNumber: 15 },
      { name: 'HARDIK GADANI', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'SIDDARTH PANCHAL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'HARDIK PATEL (VADIL)', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'AVI PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'BHARGAV AHIR', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'VIVEK PATEL (BRM)', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'ANSH GUPTA', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'PRATYUSH RANA', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'VINAY PATEL', role: 'SUBSTITUTE', squadNumber: null },
      // Scorers -> substitutes
      { name: 'ASHISH SARVAIYA', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'RAVI MORI', role: 'SUBSTITUTE', squadNumber: null },
    ],
  },
  {
    name: 'ACC-0',
    shortName: 'ACC0',
    players: [
      { name: 'JIMIT PATEL', role: 'CAPTAIN', squadNumber: null },
      { name: 'HARDIK MISTRY', role: 'VICE_CAPTAIN', squadNumber: null },
      { name: 'SARVATIT BHATT', role: 'MANAGER', squadNumber: null },
      { name: 'TANMAY PARMAR', role: 'PLAYER', squadNumber: 4 },
      { name: 'ANKIT PATEL', role: 'PLAYER', squadNumber: 5 },
      { name: 'PARAM PATEL', role: 'PLAYER', squadNumber: 6 },
      { name: 'PARTH PATEL (BRM)', role: 'PLAYER', squadNumber: 7 },
      { name: 'DHRUMIL DESAI', role: 'PLAYER', squadNumber: 8 },
      { name: 'AKSHAT PARIKH', role: 'PLAYER', squadNumber: 9 },
      { name: 'ATMIYA MAISURIA', role: 'PLAYER', squadNumber: 10 },
      { name: 'BIDHIN PATEL', role: 'PLAYER', squadNumber: 11 },
      { name: 'SIDDHARAJ CHAUHAN', role: 'PLAYER', squadNumber: 12 },
      { name: 'GAURAV PATEL', role: 'PLAYER', squadNumber: 13 },
      { name: 'VIRAJ GANDHI', role: 'PLAYER', squadNumber: 14 },
      { name: 'HARSH PATEL (PEI)', role: 'PLAYER', squadNumber: 15 },
      { name: 'BHUMIN PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'SAHAJ PATEL (GUMWOOD)', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'RAHUL KAMBARIYA', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'AMAN PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'PARTH MAVANI', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'NIRMAAN PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'SHRIMAD PAINTER', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'HARSHIT MASTER', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'AYUSH CHAUHAN', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'NIRAV PATEL (KK)', role: 'SUBSTITUTE', squadNumber: null },
      // Scorers -> substitutes
      { name: 'YOGIN PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'CHINTAN PATEL', role: 'SUBSTITUTE', squadNumber: null },
      { name: 'ASHUTOSH PATEL', role: 'SUBSTITUTE', squadNumber: null },
    ],
  },
];

/** Quick counts, handy for a sanity assertion in the seed script. */
export const accTeamCounts = accTeams.map((t) => ({
  team: t.name,
  total: t.players.length,
  squad: t.players.filter((p) => p.role !== 'SUBSTITUTE').length,
  substitutes: t.players.filter((p) => p.role === 'SUBSTITUTE').length,
}));
