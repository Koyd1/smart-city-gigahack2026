"use client";

import { cn } from "@/lib/utils";

type TypingDotsProps = {
  className?: string;
  size?: "sm" | "md";
  label?: string;
};

export default function TypingDots({ className, size = "md", label }: TypingDotsProps) {
  const sizeClass = size === "sm" ? "chat-typing--sm" : "chat-typing--md";
  const content = (
    <span className={cn("chat-typing", sizeClass, className)}>
      <span />
      <span />
      <span />
    </span>
  );

  if (!label) {
    return (
      <span aria-hidden="true" className="inline-flex">
        {content}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {content}
      <span className="sr-only">{label}</span>
    </span>
  );
}
