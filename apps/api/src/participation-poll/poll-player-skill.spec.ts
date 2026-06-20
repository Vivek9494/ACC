import { formatPollPlayerSkillLabel, PlayerRegistrationRole } from '@acc/types';

describe('formatPollPlayerSkillLabel', () => {
  it('prefers wicket keeper and opener labels', () => {
    expect(
      formatPollPlayerSkillLabel({
        battingPosition: 'Opener',
        fieldingPosition: 'Wicketkeeper',
        bowlingType: null,
        playerRole: null,
      }),
    ).toBe('Wicket Keeper');
    expect(
      formatPollPlayerSkillLabel({
        battingPosition: 'Opener',
        fieldingPosition: null,
        bowlingType: null,
        playerRole: null,
      }),
    ).toBe('Opening Batsman');
  });

  it('falls back to bowling type and registration role', () => {
    expect(
      formatPollPlayerSkillLabel({
        battingPosition: null,
        fieldingPosition: null,
        bowlingType: 'Fast',
        playerRole: null,
      }),
    ).toBe('Fast Bowler');
    expect(
      formatPollPlayerSkillLabel({
        battingPosition: null,
        fieldingPosition: null,
        bowlingType: null,
        playerRole: PlayerRegistrationRole.AllRounder,
      }),
    ).toBe('All-rounder');
  });
});
