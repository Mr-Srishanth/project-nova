import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", icon, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-display font-semibold transition-all duration-150 border-2 select-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none";

    const variantStyles = {
      primary:
        "bg-primary text-foreground border-border shadow-hard hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-hard-lg hover:bg-primary-hover",
      secondary:
        "bg-surface text-foreground border-border shadow-hard hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-hard-lg hover:bg-[#FAF8F0]",
      outline:
        "bg-transparent text-foreground border-border shadow-hard hover:-translate-x-[1px] hover:-translate-y-[1px] hover:bg-surface",
      danger:
        "bg-danger text-white border-border shadow-hard hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-hard-lg hover:opacity-90",
      ghost:
        "bg-transparent text-foreground-muted border-transparent hover:text-foreground hover:bg-foreground/5",
    };

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1.5 rounded-tactile-sm gap-1.5",
      md: "text-sm px-4 py-2 rounded-tactile gap-2",
      lg: "text-base px-5 py-2.5 rounded-tactile gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
