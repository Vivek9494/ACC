-- Per-match broadcast overlay theme (cockpit settings → overlay render by matchId).
ALTER TABLE "Match" ADD COLUMN "overlayTheme" TEXT NOT NULL DEFAULT 'theme1';
