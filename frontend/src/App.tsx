import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useUrls } from './hooks/useUrls';
import { useShorten } from './hooks/useShorten';

function App() {
  const { data: urls, isLoading, isError } = useUrls();
  const { mutate: shorten, isPending } = useShorten();
  
  const [url, setUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error('URL is required');
      return;
    }

    shorten(
      { url, customSlug, expiresAt: expiresAt || undefined },
      {
        onSuccess: (data) => {
          toast.success('URL shortened successfully!');
          setUrl('');
          setCustomSlug('');
          setExpiresAt('');
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to shorten URL');
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">SnapLink</h1>
          <p className="text-muted-foreground">High-performance distributed URL shortener</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle>Shorten URL</CardTitle>
              <CardDescription>Create a compact link for your destination</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Destination URL</Label>
                  <Input 
                    id="url" 
                    placeholder="https://example.com/..." 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Custom Slug (Optional)</Label>
                  <Input 
                    id="slug" 
                    placeholder="my-link" 
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry Date (Optional)</Label>
                  <Input 
                    id="expiry" 
                    type="date" 
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? 'Shortening...' : 'Shorten URL'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Your Links</CardTitle>
              <CardDescription>Track and manage your shortened URLs</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  Loading links...
                </div>
              ) : isError ? (
                <div className="flex items-center justify-center h-32 text-destructive">
                  Error loading links.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slug</TableHead>
                        <TableHead>Original URL</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {urls && urls.length > 0 ? (
                        urls.map((link) => (
                          <TableRow key={link.slug}>
                            <TableCell className="font-medium">
                              <a 
                                href={`/${link.slug}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {link.slug}
                              </a>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-muted-foreground">
                              {link.originalUrl}
                            </TableCell>
                            <TableCell className="text-right">
                              {link.totalClicks || 0}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center h-32 text-muted-foreground">
                            No links found. Start by shortening one!
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default App;
