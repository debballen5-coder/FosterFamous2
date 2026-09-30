import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';

import { BackendUrlError, getBackendUrl } from './backend-url';

const REFRESH_CREDENTIAL_KEY = 'foster-famous.installation-refresh.v1';
const REQUEST_TIMEOUT_MS = 15_000;

interface SessionResponse {
  accessToken: string;
  refreshCredential: string;
  accessExpiresAt: string;
  accessExpiresInSeconds: number;
}

interface ServerEnvelope<T> {
  data?: T;
  error?: { message?: string; code?: string };
}

export class AnonymousSessionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = 'AnonymousSessionError';
  }
}

type CredentialStore = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: SecureStore.SecureStoreOptions) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

const defaultCredentialStore: CredentialStore = SecureStore;
let credentialStore: CredentialStore = defaultCredentialStore;
let sessionFetch: typeof fetch = fetch;
let accessToken: string | null = null;
let sessionRequest: Promise<string> | null = null;

function isSessionResponse(value: unknown): value is SessionResponse {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<SessionResponse>;
  return (
    typeof session.accessToken === 'string' && session.accessToken.length > 0 &&
    typeof session.refreshCredential === 'string' && session.refreshCredential.length > 0 &&
    typeof session.accessExpiresAt === 'string' &&
    typeof session.accessExpiresInSeconds === 'number' && session.accessExpiresInSeconds > 0
  );
}

function secureStoreError(action: 'read' | 'save' | 'clear'): AnonymousSessionError {
  return new AnonymousSessionError(
    'This device needs to be unlocked before Foster Famous can securely prepare media.',
    0,
    `SECURE_STORE_${action.toUpperCase()}_FAILED`
  );
}

async function sessionRequestJson(path: string, body?: unknown): Promise<SessionResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await sessionFetch(`${getBackendUrl()}${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as ServerEnvelope<SessionResponse> | null;

    if (!response.ok) {
      throw new AnonymousSessionError(
        payload?.error?.message ?? 'The device service returned an unexpected response. Please try again.',
        response.status,
        payload?.error?.code ?? 'SESSION_REQUEST_FAILED'
      );
    }

    if (!isSessionResponse(payload?.data)) {
      throw new AnonymousSessionError(
        'The device service returned an unexpected response. Please try again.',
        response.status,
        'SESSION_RESPONSE_INVALID'
      );
    }

    return payload.data;
  } catch (error) {
    if (error instanceof AnonymousSessionError) throw error;
    if (error instanceof BackendUrlError) {
      throw new AnonymousSessionError(error.message, 0, error.code);
    }
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new AnonymousSessionError(
      timedOut
        ? 'Foster Famous could not reach the device service in time. Please try again.'
        : 'Foster Famous could not reach the device service right now. Please try again.',
      0,
      timedOut ? 'SESSION_TIMEOUT' : 'SESSION_NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readRefreshCredential(): Promise<string | null> {
  try {
    return await credentialStore.getItemAsync(REFRESH_CREDENTIAL_KEY);
  } catch {
    // Do not silently register a second installation when the iOS Keychain is
    // temporarily unavailable (for example, before the first unlock after reboot).
    throw secureStoreError('read');
  }
}

async function persistRefreshCredential(refreshCredential: string): Promise<void> {
  try {
    await credentialStore.setItemAsync(REFRESH_CREDENTIAL_KEY, refreshCredential, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    throw secureStoreError('save');
  }
}

async function clearRefreshCredential(): Promise<void> {
  try {
    await credentialStore.deleteItemAsync(REFRESH_CREDENTIAL_KEY);
  } catch {
    throw secureStoreError('clear');
  }
}

async function persistSessionResponse(response: SessionResponse): Promise<string> {
  await persistRefreshCredential(response.refreshCredential);
  accessToken = response.accessToken;
  return response.accessToken;
}

async function establishSession(forceRefresh: boolean): Promise<string> {
  if (!forceRefresh && accessToken) return accessToken;

  const storedCredential = await readRefreshCredential();
  if (storedCredential) {
    try {
      const response = await sessionRequestJson('/api/installations/refresh', {
        refreshCredential: storedCredential,
      });
      return await persistSessionResponse(response);
    } catch (error) {
      if (!(error instanceof AnonymousSessionError) || error.status !== 401) throw error;
      await clearRefreshCredential();
    }
  }

  const response = await sessionRequestJson('/api/installations/register');
  return persistSessionResponse(response);
}

/**
 * Silently establishes or renews the anonymous installation session. The only
 * long-lived value is held in SecureStore; access tokens stay in memory.
 */
export async function getAnonymousAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && accessToken) return accessToken;
  if (!sessionRequest) {
    sessionRequest = establishSession(forceRefresh).finally(() => {
      sessionRequest = null;
    });
  }
  return sessionRequest;
}

export function configureAnonymousSessionForTesting(options: {
  credentialStore?: CredentialStore;
  fetch?: typeof fetch;
} = {}): void {
  credentialStore = options.credentialStore ?? defaultCredentialStore;
  sessionFetch = options.fetch ?? fetch;
  accessToken = null;
  sessionRequest = null;
}

export async function clearAnonymousSessionForTesting(): Promise<void> {
  accessToken = null;
  sessionRequest = null;
  await clearRefreshCredential();
}
