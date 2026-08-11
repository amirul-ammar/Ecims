import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant: "info" | "success" | "warning" | "danger" | "purple";
  onClick?: () => void;
}

/**
 * Dashboard stats card with gradient icon, hover animation, and glow effect.
 */
export default function StatsCard({
  icon: Icon,
  label,
  value,
  variant,
  onClick,
}: StatsCardProps) {
  if (onClick) {
    return (
      <button
        type="button"
        className="stats-card clickable"
        onClick={onClick}
      >
        <div className={`stats-card-icon ${variant}`}>
          <Icon size={24} />
        </div>
        <div className="stats-card-value">{value}</div>
        <div className="stats-card-label">{label}</div>
        <div className={`stats-card-glow ${variant}`} />
      </button>
    );
  }

  return (
    <div className="stats-card">
      <div className={`stats-card-icon ${variant}`}>
        <Icon size={24} />
      </div>
      <div className="stats-card-value">{value}</div>
      <div className="stats-card-label">{label}</div>
      <div className={`stats-card-glow ${variant}`} />
    </div>
  );
}
