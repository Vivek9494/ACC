/**
 * Documented exceptions to the 12px caption floor (`TYPE.caption`).
 *
 * Phases 0–3 complete: every other mobile path must use ≥ caption.
 * Do NOT add new paths unless layout density genuinely cannot absorb 12 —
 * prefer shortening the label, widening the cell, or restructuring first.
 *
 * Reasons below are the deliberate trade-off record for Phase 3.
 *
 * @see apps/mobile/src/theme/typography.ts
 * @see tools/eslint-plugin-acc-typography/README.md
 */

/**
 * @typedef {{ path: string, reason: string }} SubCaptionAllowEntry
 */

/** @type {SubCaptionAllowEntry[]} */
export const SUB_CAPTION_ALLOWLIST_ENTRIES = [
  {
    path: 'apps/mobile/src/components/scoring/RecentBallsStrip.tsx',
    reason:
      'Adaptive ball chips: labels like "wd+2" / "nb+1" must fit fixed 32–40px circles; 12 clips multi-char codes.',
  },
  {
    path: 'apps/mobile/src/components/scoring/cockpit/ScoreSummaryPanel.tsx',
    reason:
      'Adaptive current-over ball chips (8/9/10 by label length) in a fixed-height strip; 12 overflows chip bounds.',
  },
  {
    path: 'apps/mobile/src/components/scoring/cockpit/ScorecardDockPanel.tsx',
    reason:
      'Adaptive recent-ball chips in the dock overs strip — same fixed-circle constraint as ScoreSummaryPanel.',
  },
  {
    path: 'apps/mobile/src/components/scoring/cockpit/ScoringInputPanel.tsx',
    reason:
      'Keypad cluster labels (RUNS / EXTRAS / WICKET) at 8px above a dense button grid; 12 steals vertical space from hit targets.',
  },
  {
    path: 'apps/mobile/src/components/scoring/cockpit/OverlayControlPanel.tsx',
    reason:
      'OBS "LIVE" micro-badges on compact graphic tiles; 12 collides with tile titles in the 3-col grid.',
  },
  {
    path: 'apps/mobile/src/components/scoring/cockpit/ObsOverlayLinkButton.tsx',
    reason:
      'OBS Overlay Link chrome badge — must stay pill-sized beside cockpit header controls; 12 inflates the control.',
  },
  {
    path: 'apps/mobile/src/components/scoring/cockpit/CockpitPanel.tsx',
    reason:
      'CockpitStubSlot "coming soon" badge — decorative micro-label in a dashed placeholder; caption would dominate the stub.',
  },
];

/** Glob/path list consumed by eslint.config.mjs (rule off only for these files). */
export const SUB_CAPTION_ALLOWLIST = SUB_CAPTION_ALLOWLIST_ENTRIES.map((e) => e.path);

/** Shared form controls — fontSize must stay ≥16 (iOS focus zoom). */
export const INPUT_COMPONENT_GLOBS = [
  'apps/mobile/src/components/ui/TextInput.tsx',
  'apps/mobile/src/components/ui/DateField.tsx',
  'apps/mobile/src/components/ui/TimeField.tsx',
  'apps/mobile/src/components/ui/Select.tsx',
  'apps/mobile/src/components/ui/MultiSelect.tsx',
  'apps/mobile/src/components/ui/TournamentLocationField.tsx',
  'apps/mobile/src/components/ui/TournamentDatesField.tsx',
];
