import { getApiBaseUrl } from './api-config';

const API_URL = getApiBaseUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = (options.method ?? 'GET').toUpperCase();
  let body = options.body;

  // Fastify rejects requests with Content-Type: application/json but an empty body
  if (body == null && ['POST', 'PUT', 'PATCH'].includes(method)) {
    body = '{}';
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (
    !isFormData &&
    body != null &&
    body !== '' &&
    !headers['Content-Type'] &&
    !headers['content-type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    method,
    body,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ title: 'Request failed' }));
    throw new ApiError(
      res.status,
      body.message ?? body.title ?? body.error ?? 'Unknown error',
    );
  }

  return res.json() as Promise<T>;
}
