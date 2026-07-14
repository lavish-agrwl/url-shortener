export interface ShortUrl {
  slug: string;
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface ShortenRequest {
  url: string;
  customSlug?: string;
  expiresAt?: string;
}

export interface Analytics {
  slug: string;
  totalClicks: number;
  clicksPerDay: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topCountries: { country: string; count: number }[];
}

export interface HealthStatus {
  status: string;
  redis: string;
  mongodb: string;
  queueDepth: number;
  error?: string;
}
