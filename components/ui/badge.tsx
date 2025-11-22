import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-500/20 text-brand-400 border border-brand-500/30",
        secondary: "bg-neutral-800 text-neutral-300 border border-neutral-700",
        success: "bg-success-500/20 text-success-400 border border-success-500/30",
        danger: "bg-danger-500/20 text-danger-400 border border-danger-500/30",
        warning: "bg-warning-500/20 text-warning-400 border border-warning-500/30",
        outline: "bg-transparent border border-neutral-700 text-neutral-400",
        live: "bg-success-500/20 text-success-400 border border-success-500/30 animate-pulse-slow",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
