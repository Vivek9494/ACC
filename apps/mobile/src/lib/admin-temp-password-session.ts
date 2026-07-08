/**
 * In-memory one-time reveal for admin temporary passwords.
 * Never persisted — cleared when the admin leaves the user detail screen.
 */

const revealedByUserId = new Map<string, { password: string; expiresAt: string }>();

export function setRevealedTempPassword(
  userId: string,
  password: string,
  expiresAt: string,
): void {
  revealedByUserId.set(userId, { password, expiresAt });
}

export function getRevealedTempPassword(userId: string): string | null {
  return revealedByUserId.get(userId)?.password ?? null;
}

export function clearRevealedTempPassword(userId: string): void {
  revealedByUserId.delete(userId);
}
