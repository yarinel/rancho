import { type ComponentPropsWithoutRef } from "react";

export function Card({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={`bg-surface text-ink rounded-(--radius-card) border border-border p-4 shadow-(--shadow-card) ${className}`}
      {...props}
    />
  );
}
