"use client";

import { type ComponentPropsWithoutRef } from "react";

type ChipProps = {
  selected?: boolean;
} & ComponentPropsWithoutRef<"button">;

/** Large tappable choice chip for intake questions ("קדמי / אחורי / לא יודע"). */
export function Chip({ selected = false, className = "", ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={
        "inline-flex items-center justify-center rounded-full min-h-(--tap-min) px-5 " +
        "text-base font-medium border transition-colors select-none " +
        (selected
          ? "bg-brand text-on-brand border-brand "
          : "bg-surface text-ink border-border hover:border-brand ") +
        className
      }
      {...props}
    />
  );
}
