import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Minimal token-based UI primitives (the shadcn/ui-style "owned components" foundation).
 * Hand-rolled for B8; richer shadcn components can be added via its CLI later.
 */

type ButtonVariant = "primary" | "outline" | "ghost";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border border-border bg-card text-foreground hover:bg-muted",
    ghost: "text-foreground hover:bg-muted",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-base font-semibold",
        "transition disabled:opacity-40 disabled:pointer-events-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card text-card-foreground p-5 shadow-sm", className)}
      {...props}
    />
  );
}
