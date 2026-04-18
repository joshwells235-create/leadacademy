import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-16 bg-brand-light">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy">
          <span className="text-2xl text-white font-bold">?</span>
        </div>
        <h1 className="text-2xl font-bold text-brand-navy">Page not found</h1>
        <p className="mt-2 text-sm text-neutral-600 max-w-sm mx-auto">
          The page you're looking for doesn't exist or you don't have access.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-md bg-brand-blue px-6 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark transition"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
