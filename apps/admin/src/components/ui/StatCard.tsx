import { TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Card } from './Card';
import { Icon3D } from './Icon3D';
import type { Icon3DName } from '../../assets/icons3d/manifest';
import { AnimatedCounter } from './AnimatedCounter';
import { SkeletonStatCard } from './Skeleton';

type Gradient = 'red' | 'blue' | 'green' | 'purple' | 'amber' | 'indigo';

const gradients: Record<Gradient, string> = {
  red: 'from-rose-500 to-red-400',
  blue: 'from-sky-500 to-blue-400',
  green: 'from-emerald-500 to-teal-400',
  purple: 'from-violet-500 to-purple-400',
  amber: 'from-amber-500 to-orange-400',
  indigo: 'from-indigo-500 to-blue-500',
};

interface StatCardProps {
  title: string;
  value: number;
  valuePrefix?: string;
  valueSuffix?: string;
  icon: Icon3DName;
  gradient?: Gradient;
  trend?: number;
  sparkline?: number[];
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({ title, value, valuePrefix = '', valueSuffix = '', icon, gradient = 'red', trend, sparkline, loading, onClick }: StatCardProps) {
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
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
              {trendUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className={`shrink-0 h-12 w-12 rounded-2xl bg-gradient-to-br ${gradients[gradient]} flex items-center justify-center shadow-card`}>
          <Icon3D name={icon} size={28} eager />
        </div>
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="h-10 -mx-1 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`spark-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DA3830" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#DA3830" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#DA3830" strokeWidth={1.75} fill={`url(#spark-${title.replace(/\s+/g, '')})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
