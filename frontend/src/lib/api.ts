import type { ShortUrl, Analytics, HealthStatus, ShortenRequest } from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  getUrls: () => apiFetch<ShortUrl[]>('/api/urls'),
  getAnalytics: (slug: string) => apiFetch<Analytics>(`/api/analytics/${slug}`),
  shortenUrl: (data: ShortenRequest) => 
    apiFetch<ShortUrl>('/api/shorten', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getHealth: () => apiFetch<HealthStatus>('/health'),
};
