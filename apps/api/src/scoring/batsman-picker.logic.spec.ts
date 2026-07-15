import {
  BatsmanPickerRole,
  BatsmanPickerStatus,
  DismissalType,
  formatDismissalShort,
} from '@acc/types';

describe('formatDismissalShort', () => {
  const nameOf = (id: string | null): string => {
    if (id === 'bowler-1') return 'Wood';
    if (id === 'fielder-1') return 'Butler';
    if (id === 'ext-bowler') return 'Patel';
    if (id === 'ext-fielder') return 'Shah';
    // Mirrors batsman-picker buildNameResolver miss → used to surface as "Player"
    return 'Player';
  };

  it('formats caught dismissals', () => {
    expect(
      formatDismissalShort(
        {
          dismissalType: DismissalType.Caught,
          bowlerId: 'bowler-1',
          fielderId: 'fielder-1',
        },
        nameOf,
      ),
    ).toBe('c Butler b Wood');
  });

  it('formats caught dismissals with external bowling-side names', () => {
    expect(
      formatDismissalShort(
        {
          dismissalType: DismissalType.Caught,
          bowlerId: 'ext-bowler',
          fielderId: 'ext-fielder',
        },
        nameOf,
      ),
    ).toBe('c Shah b Patel');
  });

  it('formats caught and bowled dismissals', () => {
    expect(
      formatDismissalShort(
        {
          dismissalType: DismissalType.Caught,
          bowlerId: 'bowler-1',
          fielderId: 'bowler-1',
        },
        nameOf,
      ),
    ).toBe('c & b Wood');
  });

  it('formats stumped dismissals', () => {
    expect(
      formatDismissalShort(
        {
          dismissalType: DismissalType.Stumped,
          bowlerId: 'bowler-1',
          fielderId: 'fielder-1',
        },
        nameOf,
      ),
    ).toBe('st Butler b Wood');
  });

  it('formats Mankad run-out dismissals', () => {
    expect(
      formatDismissalShort(
        {
          dismissalType: DismissalType.RunOut,
          bowlerId: null,
          fielderId: 'bowler-1',
          isMankad: true,
        },
        (id) => (id === 'bowler-1' ? 'Wood' : '—'),
      ),
    ).toBe('run out (Wood) (mankad)');
  });

  it('formats relay run-out dismissals', () => {
    expect(
      formatDismissalShort(
        {
          dismissalType: DismissalType.RunOut,
          bowlerId: null,
          fielderId: 'fielder-1',
          fielder2Id: 'fielder-2',
        },
        (id) => {
          if (id === 'fielder-1') return 'Jadeja';
          if (id === 'fielder-2') return 'Kohli';
          return '—';
        },
      ),
    ).toBe('run out (Jadeja/Kohli)');
  });

  it('formats bowled dismissals', () => {
    expect(
      formatDismissalShort(
        { dismissalType: DismissalType.Bowled, bowlerId: 'bowler-1', fielderId: null },
        nameOf,
      ),
    ).toBe('b Wood');
  });

  it('formats lbw dismissals', () => {
    expect(
      formatDismissalShort(
        { dismissalType: DismissalType.Lbw, bowlerId: 'bowler-1', fielderId: null },
        nameOf,
      ),
    ).toBe('lbw b Wood');
  });

  it('formats hit wicket dismissals', () => {
    expect(
      formatDismissalShort(
        { dismissalType: DismissalType.HitWicket, bowlerId: 'bowler-1', fielderId: null },
        nameOf,
      ),
    ).toBe('hit wicket b Wood');
  });
});

describe('BatsmanPickerStatus', () => {
  it('exposes incoming role for post-wicket selection', () => {
    expect(BatsmanPickerRole.Incoming).toBe('INCOMING');
    expect(BatsmanPickerStatus.Out).toBe('OUT');
    expect(BatsmanPickerStatus.RetiredHurt).toBe('RETIRED_HURT');
  });
});
