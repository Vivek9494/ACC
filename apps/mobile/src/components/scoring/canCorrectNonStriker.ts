import type { BatterCard } from '@acc/types';

/**
 * Non-striker may be replaced only when they have not batted (innings-start
 * correction). Vacant crease / no card yet is always allowed.
 */
export function canCorrectNonStriker(
  nonStrikerId: string | null | undefined,
  card: BatterCard | undefined,
): boolean {
  if (!nonStrikerId) {
    return true;
  }
  if (!card) {
    return true;
  }
  return card.balls === 0 && card.runs === 0 && !card.isOut;
}
