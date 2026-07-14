import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ShortUrl } from '../types/api';

export function useShorten() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.shortenUrl,
    onMutate: async (newUrl) => {
      await queryClient.cancelQueries({ queryKey: ['urls'] });

      const previousUrls = queryClient.getQueryData<ShortUrl[]>(['urls']);

      // Create an optimistic URL object
       const optimisticUrl: ShortUrl = {
         slug: 'pending...',
         shortUrl: '...',
         originalUrl: newUrl.url,
         createdAt: new Date().toISOString(),
         expiresAt: newUrl.expiresAt || null,
         totalClicks: 0,
       };

      queryClient.setQueryData<ShortUrl[]>(['urls'], (old) => 
        old ? [optimisticUrl, ...old] : [optimisticUrl]
      );

      return { previousUrls };
    },
    onError: (_err, _newUrl, context) => {
      if (context?.previousUrls) {
        queryClient.setQueryData(['urls'], context.previousUrls);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
    },
  });
}
