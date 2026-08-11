import { type LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty state with icon, message, and optional action button.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon className="empty-state-icon" size={64} strokeWidth={1} />
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-message">{message}</div>
      {action && (
        <button className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
