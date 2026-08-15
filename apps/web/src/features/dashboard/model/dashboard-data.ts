/** Dashboard data is fetched from /api/codes at runtime. Keep only deterministic
 * fallback geometry here so the shell can render while the request is pending. */
export const dashboardTrend: number[] = [0, 0];
