const API_URL = import.meta.env.VITE_API_URL || '/api';

function apiUrl(path: string) {
  return `${API_URL}${path}`;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...options?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.message || 'Não foi possível concluir a operação.', response.status);
  return payload;
}

export const api = {
  fileUrl: (path: string) => apiUrl(path),
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  uploadPdf: <T>(path: string, body: Record<string, unknown>, file: File, password = '') => {
    const metadata = encodeURIComponent(JSON.stringify({ ...body, originalName: file.name }));
    return request<T>(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'X-PDF-Metadata': metadata,
        ...(password ? { 'X-PDF-Password': encodeURIComponent(password) } : {}),
      },
      body: file,
    });
  },
};
