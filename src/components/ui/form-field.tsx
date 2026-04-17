import type { ReactNode } from "react";

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
      <span className="block text-sm font-medium text-brand-navy">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !errMsg && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
      {errMsg && <span className="mt-1 block text-xs text-brand-pink">{errMsg}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-light disabled:text-neutral-500 ${props.className ?? ""}`}
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
      className={`w-full rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? "Working..." : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-brand-pink/20 bg-brand-pink-light px-3 py-2 text-sm text-brand-pink">
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {message}
    </div>
  );
}
