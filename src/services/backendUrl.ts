/** A phone must use the protected gateway, never its own localhost. */
export function resolveBackendUrl(configured: string, origin?: string): string {
  const base = configured.trim().replace(/\/$/, '');
  if (!base || !origin) return base;
  try {
    const backend = new URL(base), page = new URL(origin);
    const loopback = (host: string) => ['localhost','127.0.0.1','[::1]'].includes(host);
    if (loopback(backend.hostname) && ((!loopback(page.hostname) && page.protocol === 'https:') ||
      (loopback(page.hostname) && page.port === '8085'))) return page.origin;
  } catch { /* Preserve existing configuration errors for the caller. */ }
  return base;
}
export const appBackendUrl = () => resolveBackendUrl(process.env.EXPO_PUBLIC_TTS_BACKEND_URL || '',
  typeof window !== 'undefined' ? window.location?.origin : undefined);

/** Keep app credentials separate from the protected gateway's own authentication. */
export function backendAuthHeaders(key: string, base = appBackendUrl(),
  origin = typeof window !== 'undefined' ? window.location?.origin : undefined): Record<string,string> {
  const protectedOrigin = !!origin && origin.startsWith('https://') && base === origin;
  return { [protectedOrigin ? 'X-Coachie-Authorization' : 'Authorization']: `Bearer ${key}` };
}
