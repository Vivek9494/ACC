import { resolveTimezoneFromCoordinates } from './tournament-timezone.utils';

describe('tournament-timezone.utils', () => {
  it('resolves Toronto coordinates to America/Toronto', () => {
    expect(resolveTimezoneFromCoordinates(43.6532, -79.3832)).toBe('America/Toronto');
  });

  it('resolves Ahmedabad coordinates to Asia/Kolkata', () => {
    expect(resolveTimezoneFromCoordinates(23.0225, 72.5714)).toBe('Asia/Kolkata');
  });
});
