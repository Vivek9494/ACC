import { formatBatterStrikeRateDisplay, formatBowlerEconomyDisplay } from '@acc/types';

describe('scorecard rate display (2 decimals)', () => {
  it('formats batting SR to two decimals', () => {
    expect(formatBatterStrikeRateDisplay({ strikeRate: 26.666, balls: 15 })).toBe('26.67');
    expect(formatBatterStrikeRateDisplay({ strikeRate: 107.14, balls: 14 })).toBe('107.14');
    expect(formatBatterStrikeRateDisplay({ strikeRate: 0, balls: 0 })).toBe('0.00');
    expect(formatBatterStrikeRateDisplay(undefined)).toBe('0.00');
  });

  it('formats bowling ECO to two decimals consistently', () => {
    expect(formatBowlerEconomyDisplay({ economy: 4.75, legalBalls: 24 })).toBe('4.75');
    expect(formatBowlerEconomyDisplay({ economy: 3.8, legalBalls: 18 })).toBe('3.80');
    expect(formatBowlerEconomyDisplay({ economy: 4, legalBalls: 12 })).toBe('4.00');
    expect(formatBowlerEconomyDisplay({ economy: 0, legalBalls: 0 })).toBe('0.00');
  });
});
