/** Structured console logging for geofence attendance diagnostics. */
export function geofenceLog(step: string, detail: Record<string, unknown> = {}): void {
  console.log(`[geofence] ${step}`, detail);
}
