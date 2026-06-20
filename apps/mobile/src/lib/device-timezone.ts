/** Viewer device IANA timezone from the JS runtime (React Native / web). */
export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
