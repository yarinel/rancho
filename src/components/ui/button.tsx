import { type ComponentPropsWithoutRef, type ElementType } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong",
  secondary:
    "bg-surface text-ink border border-border hover:border-brand active:border-brand-strong",
  ghost: "bg-transparent text-ink hover:bg-brand-soft",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-(--radius-control) " +
  "min-h-(--tap-min) px-6 font-medium text-base select-none " +
  "transition-colors disabled:opacity-50 disabled:pointer-events-none";

type ButtonProps<T extends ElementType> = {
  as?: T;
  variant?: Variant;
} & ComponentPropsWithoutRef<T>;

/** Polymorphic button; render as <a> via `as="a"` for link-styled CTAs. */
export function Button<T extends ElementType = "button">({
  as,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps<T>) {
  const Component = (as ?? "button") as ElementType;
  return (
    <Component
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
