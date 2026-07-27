import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface RiskBadgeProps {
  level: string;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const riskConfig: Record<string, { label: string; className: string }> = {
    high: { label: 'High Risk', className: 'bg-destructive/20 text-destructive border-destructive/30' },
    medium: { label: 'Medium Risk', className: 'bg-accent/20 text-accent-foreground border-accent/30' },
    low: { label: 'Low Risk', className: 'bg-chart-3/20 text-chart-3 border-chart-3/30' },
  };

  const config = riskConfig[level.toLowerCase()] || riskConfig.low;

  return (
    <Badge className={`${config.className} border gap-1 font-medium`}>
      {level.toLowerCase() === 'high' && <AlertTriangle className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
}
