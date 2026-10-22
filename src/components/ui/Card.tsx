import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "flat";
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", interactive = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface border-2 border-border rounded-tactile p-5 transition-all duration-150",
          variant === "default" && "shadow-hard",
          variant === "muted" && "bg-[#FAF7ED] shadow-hard",
          variant === "flat" && "shadow-none",
          interactive &&
            "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-lg cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
