export function placesRateLimitKey(userId: string): string {
  return `places:rate:${userId}`;
}
