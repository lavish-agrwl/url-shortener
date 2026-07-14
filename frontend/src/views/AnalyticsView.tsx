import { useParams, Link } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { useAnalytics } from '@/hooks/useAnalytics';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalyticsView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: analytics, isLoading, isError } = useAnalytics(slug!);

  if (!slug) return <div>Slug is required</div>;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-8 flex items-center justify-center h-screen text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div className="max-w-5xl mx-auto p-8 flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-destructive font-medium">Failed to load analytics</div>
        <Link to="/" className={buttonVariants({ variant: 'default' })}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const chartData = {
    labels: analytics.clicksPerDay.map(d => d.date),
    datasets: [
      {
        label: 'Clicks',
        data: analytics.clicksPerDay.map(d => d.count),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              ← Back
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Analytics: {slug}</h1>
          </div>
          <p className="text-muted-foreground ml-20">Performance tracking for your short link</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Clicks</CardDescription>
            <CardTitle className="text-3xl">{analytics.totalClicks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Referrer</CardDescription>
            <CardTitle className="text-lg truncate">
              {analytics.topReferrers[0]?.referrer || 'None'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Country</CardDescription>
            <CardTitle className="text-lg">
              {analytics.topCountries[0]?.country || 'None'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Clicks Over Time</CardTitle>
          <CardDescription>Last 30 days of activity</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <Line data={chartData} options={chartOptions} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topReferrers.map((ref, i) => (
                <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <span className="truncate text-sm text-muted-foreground">{ref.referrer}</span>
                  <span className="font-medium">{ref.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Countries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topCountries.map((country, i) => (
                <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <span className="text-sm text-muted-foreground">{country.country}</span>
                  <span className="font-medium">{country.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
