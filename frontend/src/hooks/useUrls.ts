import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ShortUrl } from '../types/api';

export function useUrls() {
  return useQuery<ShortUrl[]>({
    queryKey: ['urls'],
    queryFn: api.getUrls,
  });
}
