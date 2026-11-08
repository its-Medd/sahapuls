/** Exact configured origin plus same-port loopback aliases for local development. */
export function isAllowedOrigin(origin: string | undefined, configured: string): boolean {
  if (!origin || configured === '*' || origin === configured) return true;
  try {
    const expected = new URL(configured);
    const candidate = new URL(origin);
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return (
      loopback.has(expected.hostname) &&
      loopback.has(candidate.hostname) &&
      expected.protocol === candidate.protocol &&
      expected.port === candidate.port &&
      origin === candidate.origin &&
      !candidate.username &&
      !candidate.password
    );
  } catch {
    return false;
  }
}
