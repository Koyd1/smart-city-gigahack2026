import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-[0.9375rem] leading-snug",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-[#1597D1] to-[#08679A] text-white border-none rounded-full hover:opacity-90",
        secondary:
          "bg-white text-gray-900 border border-border-strong rounded-full hover:bg-gray-50",
        outline:
          "bg-transparent text-orange-500 border-[1.5px] border-orange-400 rounded-full hover:bg-orange-50",
        ghost:
          "bg-transparent text-gray-600 border-none hover:bg-gray-100 rounded-lg",
      },
      size: {
        sm: "px-3.5 py-1.5 text-[0.8125rem]",
        md: "px-5 py-2.5",
        lg: "px-7 py-3.5 text-base",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
