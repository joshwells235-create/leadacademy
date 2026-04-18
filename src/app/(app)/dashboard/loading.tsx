export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-40 rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-56 rounded bg-neutral-200" />
      </div>

      <div className="mb-8">
        <div className="h-3 w-12 rounded bg-neutral-200 mb-3" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-32 rounded bg-neutral-200" />
            <div className="mt-3 h-3 w-full rounded bg-neutral-200" />
            <div className="mt-2 h-3 w-2/3 rounded bg-neutral-200" />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-neutral-200" />
            <div className="mt-3 h-3 w-full rounded bg-neutral-200" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-3 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-16 rounded bg-neutral-200" />
            <div className="mt-2 h-6 w-8 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
