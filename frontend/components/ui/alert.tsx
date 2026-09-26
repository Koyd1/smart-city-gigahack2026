import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-3 rounded-lg px-4 py-3 text-sm border",
  {
    variants: {
      variant: {
        error: "bg-red-50 text-red-800 border-red-200",
        success: "bg-green-50 text-green-800 border-green-200",
        warning: "bg-amber-50 text-amber-800 border-amber-200",
      },
    },
    defaultVariants: {
      variant: "error",
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant, className }))} {...props} />
  );
}

export { Alert, alertVariants };
