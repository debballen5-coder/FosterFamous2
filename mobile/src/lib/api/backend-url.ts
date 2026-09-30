export class BackendUrlError extends Error {
  constructor(
    message: string,
    readonly code: 'MISSING_BACKEND_URL' | 'INVALID_BACKEND_URL'
  ) {
    super(message);
    this.name = 'BackendUrlError';
  }
}

/**
 * Public mobile configuration is an API origin, rather than an endpoint path.
 * Accepting a legacy /api suffix avoids producing /api/api/... requests while
 * rejecting other paths that could send installation credentials elsewhere.
 */
export function getBackendUrl(): string {
  const configured = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (!configured) {
    throw new BackendUrlError('The content service is not configured.', 'MISSING_BACKEND_URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new BackendUrlError('The content service is not configured.', 'INVALID_BACKEND_URL');
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
  const isSupportedOrigin =
    parsed.protocol === 'https:' &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash &&
    (normalizedPath === '/' || normalizedPath === '/api');

  if (!isSupportedOrigin) {
    throw new BackendUrlError('The content service is not configured.', 'INVALID_BACKEND_URL');
  }

  return parsed.origin;
}
