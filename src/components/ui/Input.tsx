import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);
    return (
      <div className="space-y-1 text-left w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full bg-[#FAF7ED] border-2 border-border rounded-tactile px-3.5 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-foreground transition-all duration-150 shadow-[inset_2px_2px_0_rgba(21,58,82,0.08)]",
            error && "border-danger ring-danger",
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-[11px] font-sans text-foreground-muted">{hint}</p>}
        {error && <p className="text-[11px] font-mono text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, rows = 3, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);
    return (
      <div className="space-y-1 text-left w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          className={cn(
            "w-full bg-[#FAF7ED] border-2 border-border rounded-tactile p-3.5 text-sm text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-foreground transition-all duration-150 shadow-[inset_2px_2px_0_rgba(21,58,82,0.08)]",
            error && "border-danger ring-danger",
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-[11px] font-sans text-foreground-muted">{hint}</p>}
        {error && <p className="text-[11px] font-mono text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
