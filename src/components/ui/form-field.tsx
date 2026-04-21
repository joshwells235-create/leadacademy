import type { ReactNode } from "react";

// Shared form primitives — label, text input, submit button, error /
// success banners. Theme-aware: surfaces resolve through CSS variables
// so every form across the app (auth, profile, admin forms, etc.) flips
// with the active Editorial/Cinematic theme without touching each page.
export function FormField({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string | string[];
  children: ReactNode;
  hint?: string;
}) {
  const errMsg = Array.isArray(error) ? error[0] : error;
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && !errMsg && (
        <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>
      )}
      {errMsg && (
        <span className="mt-1.5 block text-xs" style={{ color: "var(--color-danger)" }}>
          {errMsg}
        </span>
      )}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 text-sm text-ink outline-none disabled:opacity-70 ${props.className ?? ""}`}
      style={{
        background: "var(--t-paper)",
        border: "1px solid var(--t-rule)",
        borderRadius: 8,
      }}
    />
  );
}

export function SubmitButton({
  pending,
  children,
  className = "",
}: {
  pending: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-full px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      style={{
        background: "var(--t-accent)",
        boxShadow: "0 4px 20px var(--t-accent-soft)",
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      className="rounded-md px-3 py-2.5 text-sm"
      style={{
        color: "var(--color-danger)",
        background: "var(--color-danger-light)",
        border: "1px solid var(--color-danger)",
        borderColor: "color-mix(in srgb, var(--color-danger) 25%, transparent)",
      }}
    >
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      className="rounded-md px-3 py-2.5 text-sm"
      style={{
        color: "var(--t-blue)",
        background: "var(--t-accent-soft)",
        border: "1px solid var(--t-rule)",
      }}
    >
      {message}
    </div>
  );
}
