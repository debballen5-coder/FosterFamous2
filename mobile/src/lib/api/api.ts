import { fetch } from 'expo/fetch';
import {
  AnonymousSessionError,
  getAnonymousAccessToken,
} from './anonymous-session';
import { BackendUrlError, getBackendUrl } from './backend-url';

// Response envelope type - all app routes return { data: T }
interface ApiResponse<T> {
  data: T;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
    code?: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: string;
  body?: string | FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

async function sendRequest(baseUrl: string, url: string, options: RequestOptions, accessToken: string): Promise<Response> {
  return fetch(`${baseUrl}${url}`, {
    method: options.method,
    body: options.body,
    signal: options.signal,
    headers: {
      ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

const request = async <T>(url: string, options: RequestOptions = {}): Promise<T> => {
  let response: Response;
  try {
    const baseUrl = getBackendUrl();
    response = await sendRequest(baseUrl, url, options, await getAnonymousAccessToken());
    if (response.status === 401) {
      // A single silent renewal protects an expired access token without a retry loop.
      response = await sendRequest(baseUrl, url, options, await getAnonymousAccessToken(true));
    }
  } catch (error) {
    if (error instanceof AnonymousSessionError || error instanceof BackendUrlError) {
      throw new ApiError(error.message, error.code, error instanceof AnonymousSessionError ? error.status : 0);
    }
    throw error;
  }

  // 1. Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // 2. JSON responses: parse and unwrap { data }
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const json = (await response.json()) as ApiResponse<T> & ApiErrorResponse;
    if (!response.ok) {
      throw new ApiError(
        json.error?.message ?? 'Something went wrong. Please try again.',
        json.error?.code ?? 'REQUEST_FAILED',
        response.status
      );
    }
    return json.data;
  }

  if (!response.ok) {
    throw new ApiError('The service is temporarily unavailable.', 'REQUEST_FAILED', response.status);
  }

  // 3. Non-JSON: return undefined
  return undefined as T;
};

export const api = {
  get: <T>(url: string, signal?: AbortSignal, headers?: Record<string, string>) =>
    request<T>(url, { signal, headers }),
  post: <T, TBody = unknown>(
    url: string,
    body: TBody,
    signal?: AbortSignal,
    headers?: Record<string, string>
  ) => request<T>(url, { method: 'POST', body: JSON.stringify(body), signal, headers }),
  postForm: <T>(url: string, body: FormData, headers?: Record<string, string>) =>
    request<T>(url, { method: 'POST', body, headers }),
  put: <T, TBody = unknown>(
    url: string,
    body: TBody,
    signal?: AbortSignal,
    headers?: Record<string, string>
  ) => request<T>(url, { method: 'PUT', body: JSON.stringify(body), signal, headers }),
  delete: <T>(url: string, signal?: AbortSignal, headers?: Record<string, string>) =>
    request<T>(url, { method: 'DELETE', signal, headers }),
  patch: <T, TBody = unknown>(
    url: string,
    body: TBody,
    signal?: AbortSignal,
    headers?: Record<string, string>
  ) => request<T>(url, { method: 'PATCH', body: JSON.stringify(body), signal, headers }),
};
