import {
  buildKnockoutTeamCountOptions,
  evenCeil,
  validateKnockoutTeamCount,
} from '@acc/types';

describe('knockout team count helpers', () => {
  describe('evenCeil', () => {
    it('returns the same even integer when already even', () => {
      expect(evenCeil(8)).toBe(8);
    });

    it('rounds up odd integers to the next even', () => {
      expect(evenCeil(7)).toBe(8);
    });
  });

  describe('buildKnockoutTeamCountOptions', () => {
    it('builds even options from group floor through total teams', () => {
      expect(buildKnockoutTeamCountOptions(7, 28)).toEqual([
        { value: '8', label: '8' },
        { value: '10', label: '10' },
        { value: '12', label: '12' },
        { value: '14', label: '14' },
        { value: '16', label: '16' },
        { value: '18', label: '18' },
        { value: '20', label: '20' },
        { value: '22', label: '22' },
        { value: '24', label: '24' },
        { value: '26', label: '26' },
        { value: '28', label: '28' },
      ]);
    });

    it('returns no options when prerequisites are not met', () => {
      expect(buildKnockoutTeamCountOptions(0, 28)).toEqual([]);
    });
  });

  describe('validateKnockoutTeamCount', () => {
    it('rejects odd values', () => {
      expect(
        validateKnockoutTeamCount(9, { groupCount: 7, totalTeams: 28 }),
      ).toMatch(/even/i);
    });

    it('rejects values below the group-topper floor', () => {
      expect(
        validateKnockoutTeamCount(6, { groupCount: 7, totalTeams: 28 }),
      ).toMatch(/at least 8/i);
    });

    it('rejects values above total teams', () => {
      expect(
        validateKnockoutTeamCount(30, { groupCount: 7, totalTeams: 28 }),
      ).toMatch(/exceed 28/i);
    });

    it('accepts valid even values within bounds', () => {
      expect(
        validateKnockoutTeamCount(16, { groupCount: 7, totalTeams: 28 }),
      ).toBeNull();
    });
  });
});
