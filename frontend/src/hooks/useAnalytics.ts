import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Analytics } from '../types/api';

export function useAnalytics(slug: string) {
  return useQuery<Analytics>({
    queryKey: ['analytics', slug],
    queryFn: () => api.getAnalytics(slug),
    enabled: !!slug,
  });
}
