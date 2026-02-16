import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
}

const variantStyles = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
  info: "text-info bg-info/10",
};

const KpiCard = ({ title, value, subtitle, trend, icon: Icon, variant = "default" }: KpiCardProps) => {
  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? "text-success" : trend && trend < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="glass-card p-4 sm:p-5 animate-slide-in hover:border-primary/20 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${variantStyles[variant]}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-foreground font-mono tracking-tight">{value}</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{title}</p>
        {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export default KpiCard;
