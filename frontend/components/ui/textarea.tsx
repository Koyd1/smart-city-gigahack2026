import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "w-full min-h-[120px] resize-y rounded-lg bg-input border border-border px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 transition-colors focus:border-orange-400 focus:ring-[3px] focus:ring-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
