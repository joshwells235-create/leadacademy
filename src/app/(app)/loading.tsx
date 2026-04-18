export default function AppLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-7 w-48 rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-72 rounded bg-neutral-200" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-16 rounded bg-neutral-200" />
            <div className="mt-2 h-6 w-10 rounded bg-neutral-200" />
          </div>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-neutral-200" />
            <div className="mt-3 h-3 w-full rounded bg-neutral-200" />
            <div className="mt-2 h-3 w-3/4 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
