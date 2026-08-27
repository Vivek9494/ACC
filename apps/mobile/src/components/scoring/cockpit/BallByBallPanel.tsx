import { groupTimelineByOver, type InningsScorecard } from '@acc/types';
import { createElement, type CSSProperties, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';

import { CockpitPanel } from './CockpitPanel';
import { extrasTypeFromCode, isExtraCode } from './cockpit-stats';

/**
 * Same naming authority as scorecard tables (`nameOf` from display.players + squads).
 * Null or unresolvable ids render "—" — never invent a label.
 */
function ballParticipantLabel(
  id: string | null,
  nameOf: (id: string | null) => string,
): string {
  if (!id) return '—';
  const label = nameOf(id);
  return label === 'Player' ? '—' : label;
}

/** Extra label for the Extras column — empty when the ball is not an extra. */
function extrasCellLabel(code: string): string {
  const label = extrasTypeFromCode(code);
  return label === '—' ? '' : label;
}

function groupEntriesByOver(timeline: InningsScorecard['timeline']): {
  overNumber: number;
  runs: number;
  wickets: number;
  entries: InningsScorecard['timeline'];
}[] {
  const summaries = groupTimelineByOver(timeline);
  const map = new Map<number, InningsScorecard['timeline']>();
  for (const entry of timeline) {
    if (entry.overNumber === null) continue;
    const list = map.get(entry.overNumber) ?? [];
    list.push(entry);
    map.set(entry.overNumber, list);
  }
  return summaries
    .slice()
    .reverse()
    .map((over) => ({
      overNumber: over.overNumber,
      runs: over.runs,
      wickets: over.wickets,
      entries: (map.get(over.overNumber) ?? []).slice().reverse(),
    }));
}

const TABLE_MIN_WIDTH = 506;

const SCROLL_BODY: ViewStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto' as unknown as ViewStyle['overflow'],
};

const TABLE_STYLE: CSSProperties = {
  width: '100%',
  minWidth: TABLE_MIN_WIDTH,
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const TH_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  padding: '3px 6px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-on-surface-variant, #78716c)',
  backgroundColor: 'var(--color-surface-container-low, #f5f5f4)',
  borderBottom: '1px solid var(--color-outline-variant, #e7e5e4)',
  whiteSpace: 'nowrap',
};

const TD_STYLE: CSSProperties = {
  padding: '3px 6px',
  fontSize: 12,
  color: 'var(--color-on-surface, #1c1917)',
  borderBottom:
    '1px solid color-mix(in srgb, var(--color-outline-variant, #e7e5e4) 50%, transparent)',
  verticalAlign: 'middle',
};

const TD_ELLIPSIS: CSSProperties = {
  ...TD_STYLE,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const TD_RIGHT: CSSProperties = {
  ...TD_STYLE,
  textAlign: 'right',
};

const TD_CENTER: CSSProperties = {
  ...TD_STYLE,
  textAlign: 'center',
};

const TH_RUNS: CSSProperties = {
  ...TH_STYLE,
  textAlign: 'right',
  paddingRight: 14,
};

const TD_RUNS: CSSProperties = {
  ...TD_RIGHT,
  paddingRight: 14,
};

const TH_EXTRAS: CSSProperties = {
  ...TH_STYLE,
  paddingLeft: 10,
};

const TD_EXTRAS: CSSProperties = {
  ...TD_STYLE,
  paddingLeft: 10,
};

const OVER_ROW: CSSProperties = {
  padding: '3px 6px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-on-surface-variant, #78716c)',
  backgroundColor: 'var(--color-surface-container-low, #f5f5f4)',
};

const WKT_CHIP: CSSProperties = {
  display: 'inline-block',
  minWidth: 18,
  padding: '0 5px',
  borderRadius: 4,
  backgroundColor: 'var(--color-secondary-900, #1c1917)',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: '16px',
  textAlign: 'center',
};

const VIDEO_PLACEHOLDER: CSSProperties = {
  display: 'inline-block',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--color-on-surface-variant, #a8a29e)',
  fontSize: 11,
  cursor: 'default',
  whiteSpace: 'nowrap',
};

function Colgroup(): ReactNode {
  return createElement(
    'colgroup',
    null,
    createElement('col', { style: { width: 40 } }),
    createElement('col', { style: { width: 96 } }),
    createElement('col', { style: { width: 132 } }),
    createElement('col', { style: { width: 36 } }),
    createElement('col', { style: { width: 52 } }),
    createElement('col', { style: { width: 44 } }),
    createElement('col', { style: { width: 56 } }),
  );
}

/** Per-ball video cell — placeholder until clip capture exists; keyed by ball sequence. */
function VideoCell({ ballId }: { ballId: string }): ReactNode {
  return createElement(
    'button',
    {
      type: 'button',
      'data-ball-id': ballId,
      disabled: true,
      title: 'Ball clip — coming soon',
      'aria-label': `Ball ${ballId} video clip unavailable`,
      style: VIDEO_PLACEHOLDER,
    },
    '—',
  );
}

export function BallByBallPanel({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const overs = groupEntriesByOver(innings.timeline);
  const colCount = 7;

  const header = createElement(
    'thead',
    null,
    createElement(
      'tr',
      null,
      createElement('th', { style: TH_STYLE }, '#'),
      createElement('th', { style: TH_STYLE }, 'Batter'),
      createElement('th', { style: TH_STYLE }, 'Bowler'),
      createElement('th', { style: TH_RUNS }, 'R'),
      createElement('th', { style: TH_EXTRAS }, 'Extras'),
      createElement('th', { style: { ...TH_STYLE, textAlign: 'center' } }, 'Wkt'),
      createElement('th', { style: { ...TH_STYLE, textAlign: 'center' } }, 'Video'),
    ),
  );

  const bodyRows: ReactNode[] = [];
  if (overs.length === 0) {
    bodyRows.push(
      createElement(
        'tr',
        { key: 'empty' },
        createElement(
          'td',
          {
            colSpan: colCount,
            style: { ...TD_STYLE, textAlign: 'center', padding: '24px 8px', color: '#78716c' },
          },
          'No deliveries yet',
        ),
      ),
    );
  } else {
    for (const over of overs) {
      bodyRows.push(
        createElement(
          'tr',
          { key: `over-${over.overNumber}` },
          createElement(
            'td',
            { colSpan: colCount, style: OVER_ROW },
            `Over ${over.overNumber} · ${over.runs} runs${
              over.wickets > 0 ? ` · ${over.wickets} wkt` : ''
            }`,
          ),
        ),
      );
      for (const entry of over.entries) {
        const ballId = String(entry.sequence);
        const batter = ballParticipantLabel(entry.strikerId, nameOf);
        const bowler = ballParticipantLabel(entry.bowlerId, nameOf);
        bodyRows.push(
          createElement(
            'tr',
            { key: entry.sequence },
            createElement('td', { style: TD_STYLE }, entry.label || '—'),
            createElement('td', { style: TD_ELLIPSIS, title: batter }, batter),
            createElement('td', { style: TD_ELLIPSIS, title: bowler }, bowler),
            createElement(
              'td',
              { style: TD_RUNS },
              isExtraCode(entry.code) ? '—' : String(entry.runs),
            ),
            createElement('td', { style: TD_EXTRAS }, extrasCellLabel(entry.code)),
            createElement(
              'td',
              { style: TD_CENTER },
              entry.isWicket ? createElement('span', { style: WKT_CHIP }, 'W') : null,
            ),
            createElement('td', { style: TD_CENTER }, VideoCell({ ballId })),
          ),
        );
      }
    }
  }

  const table = createElement(
    'table',
    { style: TABLE_STYLE },
    Colgroup(),
    header,
    createElement('tbody', null, ...bodyRows),
  );

  return (
    <CockpitPanel title="Ball by Ball" live bodyNoPad bodyAbsolute>
      <View style={SCROLL_BODY}>{table}</View>
    </CockpitPanel>
  );
}
