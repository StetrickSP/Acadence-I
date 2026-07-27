import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent' | 'destructive';
}

export function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const iconColors = {
    default: 'text-muted-foreground bg-muted',
    primary: 'text-primary bg-primary/10',
    accent: 'text-accent-foreground bg-accent',
    destructive: 'text-destructive bg-destructive/10',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold font-mono tracking-tight">{value}</p>
            {trend && (
              <p className={`text-sm mt-2 ${trend.positive ? 'text-chart-3' : 'text-destructive'}`}>
                {trend.value}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${iconColors[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
