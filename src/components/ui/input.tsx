import { type ComponentPropsWithoutRef, useId } from "react";

type InputProps = {
  label: string;
  hint?: string;
  error?: string;
} & ComponentPropsWithoutRef<"input">;

/** Labeled text input; label is mandatory for accessibility. */
export function Input({
  label,
  hint,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          "min-h-(--tap-min) rounded-(--radius-control) border bg-surface px-4 text-base text-ink " +
          "placeholder:text-ink-muted " +
          (error ? "border-safety-unsafe" : "border-border focus:border-brand")
        }
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-safety-unsafe">
          {error}
        </p>
      )}
    </div>
  );
}
