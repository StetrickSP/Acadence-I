import { Badge } from '@/components/ui/badge';

interface GradeBadgeProps {
  letter: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function GradeBadge({ letter, size = 'md' }: GradeBadgeProps) {
  if (!letter) {
    return <Badge variant="outline" className="font-mono">N/A</Badge>;
  }

  const gradeColors: Record<string, string> = {
    'A+': 'bg-chart-3/20 text-chart-3 border-chart-3/30',
    'A': 'bg-chart-3/20 text-chart-3 border-chart-3/30',
    'A-': 'bg-chart-3/20 text-chart-3 border-chart-3/30',
    'B+': 'bg-primary/20 text-primary border-primary/30',
    'B': 'bg-primary/20 text-primary border-primary/30',
    'B-': 'bg-primary/20 text-primary border-primary/30',
    'C+': 'bg-accent/20 text-accent-foreground border-accent/30',
    'C': 'bg-accent/20 text-accent-foreground border-accent/30',
    'C-': 'bg-accent/20 text-accent-foreground border-accent/30',
    'D+': 'bg-destructive/20 text-destructive border-destructive/30',
    'D': 'bg-destructive/20 text-destructive border-destructive/30',
    'D-': 'bg-destructive/20 text-destructive border-destructive/30',
    'F': 'bg-destructive/30 text-destructive border-destructive/40',
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <Badge className={`${gradeColors[letter] || 'bg-muted text-muted-foreground border-border'} ${sizeClasses[size]} font-mono font-semibold border`}>
      {letter}
    </Badge>
  );
}
