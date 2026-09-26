import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-semibold text-xs rounded-full",
  {
    variants: {
      variant: {
        ready: "bg-emerald-100 text-emerald-800 px-2.5 py-0.5",
        pending: "bg-amber-100 text-amber-800 px-2.5 py-0.5",
        processing: "bg-blue-100 text-blue-800 px-2.5 py-0.5",
        error: "bg-red-100 text-red-800 px-2.5 py-0.5",
        dark: "bg-gray-900 text-white px-2.5 py-1",
        orange: "bg-orange-100 text-orange-700 px-2.5 py-1",
      },
      dot: {
        true: "",
      },
    },
    defaultVariants: {
      variant: "ready",
      dot: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, dot, className }))} {...props}>
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
            "bg-emerald-500": variant === "ready",
            "bg-amber-500": variant === "pending",
            "bg-blue-500": variant === "processing",
            "bg-red-500": variant === "error",
          })}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
