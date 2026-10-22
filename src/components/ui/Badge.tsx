import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "blue" | "yellow" | "muted" | "danger";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "muted",
  children,
  ...props
}) => {
  const variantStyles = {
    primary: "bg-primary text-foreground border-border",
    blue: "bg-accent-blue text-foreground border-border",
    yellow: "bg-accent-yellow text-foreground border-border",
    muted: "bg-[#FAF7ED] text-foreground-muted border-border",
    danger: "bg-danger text-white border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-tactile-sm text-[11px] font-mono font-medium border border-border shadow-[1px_1px_0_var(--border)]",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
