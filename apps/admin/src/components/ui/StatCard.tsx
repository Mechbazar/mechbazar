import { TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Card } from './Card';
import { Icon3D } from './Icon3D';
import type { Icon3DName } from '../../assets/icons3d/manifest';
import { AnimatedCounter } from './AnimatedCounter';
import { SkeletonStatCard } from './Skeleton';

type Gradient = 'red' | 'blue' | 'green' | 'purple' | 'amber' | 'indigo';

// 'red' renders the bold brand-gradient tile (reserved for a page's primary/
// hero metric); every other variant is a restrained tinted chip so pages that
// color-code stats (e.g. amber for low-stock warnings) keep that meaning
// without reintroducing the old rainbow-gradient-square look.
const tintedTiles: Record<Exclude<Gradient, 'red'>, string> = {
  blue: 'bg-sky-500/10 text-sky-400 border border-sky-500/15',
  green: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15',
  purple: 'bg-violet-500/10 text-violet-400 border border-violet-500/15',
  amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/15',
  indigo: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15',
};

interface StatCardProps {
  title: string;
  value: number;
  valuePrefix?: string;
  valueSuffix?: string;
  icon: Icon3DName;
  gradient?: Gradient;
  trend?: number;
  trendLabel?: string;
  sparkline?: number[];
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({ title, value, valuePrefix = '', valueSuffix = '', icon, gradient = 'red', trend, trendLabel, sparkline, loading, onClick }: StatCardProps) {
  if (loading) return <SkeletonStatCard />;

  const trendUp = typeof trend === 'number' && trend >= 0;

  return (
    <Card hover={!!onClick} onClick={onClick} className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content-secondary truncate">{title}</p>
          <p className="mt-2 text-2xl font-bold text-content-primary tabular-nums">
            <AnimatedCounter value={value} prefix={valuePrefix} suffix={valueSuffix} />
          </p>
          {typeof trend === 'number' && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className={`inline-flex items-center gap-1 font-semibold ${trendUp ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                {trendUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {Math.abs(trend).toFixed(1)}%
              </span>
              {trendLabel && <span className="text-content-muted">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div
          className={`shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${
            gradient === 'red' ? 'icon-tile text-white' : tintedTiles[gradient]
          }`}
        >
          <Icon3D name={icon} size={22} strokeWidth={1.75} />
        </div>
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="h-10 -mx-1 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`spark-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E11D2E" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#E11D2E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#E11D2E" strokeWidth={1.75} fill={`url(#spark-${title.replace(/\s+/g, '')})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
