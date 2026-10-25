import React, { useEffect } from "react";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
} from "lucide-react";
import type { UIStudioNotification } from "@/types/uiStudio";

interface InAppNotificationBannerProps {
  notifications: UIStudioNotification[];
  onDismiss: (id: string) => void;
  autoDismissMs?: number;
}

const SingleNotificationItem: React.FC<{
  notification: UIStudioNotification;
  onDismiss: (id: string) => void;
  autoDismissMs: number;
}> = ({ notification: n, onDismiss, autoDismissMs }) => {
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      onDismiss(n.id);
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [n.id, onDismiss, autoDismissMs]);

  const icon = {
    info: <Info className="w-4 h-4 text-sky-300 shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />,
    error: <XCircle className="w-4 h-4 text-red-300 shrink-0" />,
  }[n.type];

  const bgBorder = {
    info: "bg-[#15181f] border-blue-200 text-blue-900 shadow-sm",
    success: "bg-[#15181f] border-emerald-500/30 text-emerald-900 shadow-sm",
    warning: "bg-[#15181f] border-amber-500/30 text-amber-900 shadow-sm",
    error: "bg-[#15181f] border-red-500/30 text-red-900 shadow-sm",
  }[n.type];

  return (
    <div
      className={`p-3 rounded-md border flex items-start justify-between gap-2.5 pointer-events-auto transition-all animate-fadeIn ${bgBorder}`}
    >
      <div className="flex items-start gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="text-xs font-bold leading-tight truncate">{n.title}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug break-words">
            {n.message}
          </div>
          {n.actionLabel && n.onAction && (
            <button
              type="button"
              onClick={() => {
                n.onAction?.();
                onDismiss(n.id);
              }}
              className="mt-1.5 text-[10px] font-bold text-primary hover:underline"
            >
              {n.actionLabel}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(n.id)}
        className="text-zinc-400 hover:text-zinc-100 p-0.5 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  notifications,
  onDismiss,
  autoDismissMs = 2500,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="UI Studio Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {notifications.map((n) => (
        <SingleNotificationItem
          key={n.id}
          notification={n}
          onDismiss={onDismiss}
          autoDismissMs={autoDismissMs}
        />
      ))}
    </div>
  );
};
