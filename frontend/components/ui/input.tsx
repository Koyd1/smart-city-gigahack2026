import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, suffix, type, wrapperClassName, ...props }, ref) => {
    if (icon) {
      return (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-input border border-border px-3 transition-colors focus-within:border-orange-400 focus-within:ring-[3px] focus-within:ring-orange-500/25",
            wrapperClassName
          )}
        >
          <span className="text-gray-400 text-base shrink-0">{icon}</span>
          <input
            type={type}
            className={cn(
              "min-w-0 flex-1 py-2.5 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-400 text-sm",
              className
            )}
            ref={ref}
            {...props}
          />
          {suffix ? <span className="shrink-0 z-10 pointer-events-auto">{suffix}</span> : null}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "w-full rounded-lg bg-input border border-border px-3.5 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition-colors focus:border-orange-400 focus:ring-[3px] focus:ring-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
