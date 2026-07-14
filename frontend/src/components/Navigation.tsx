import { Link } from 'react-router-dom';
import { useHealth } from '@/hooks/useHealth';
import { cn } from '@/lib/utils';

export default function Navigation() {
  const { data: health, isLoading } = useHealth();

  const getStatusColor = () => {
    if (isLoading) return 'bg-gray-400';
    if (health?.status === 'ok') return 'bg-green-500';
    return 'bg-red-500';
  };

  return (
    <nav className="flex items-center justify-between py-4 mb-8 border-b">
      <Link to="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
        SnapLink
      </Link>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted border text-xs font-medium">
          <span className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            getStatusColor()
          )} />
          <span className="text-muted-foreground">
            System {isLoading ? 'Checking...' : health?.status === 'ok' ? 'Healthy' : 'Degraded'}
          </span>
        </div>
      </div>
    </nav>
  );
}
