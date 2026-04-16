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
      <span className="block text-sm font-medium text-neutral-800">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !errMsg && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
      {errMsg && <span className="mt-1 block text-xs text-red-600">{errMsg}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500 ${props.className ?? ""}`}
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
      className={`w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
