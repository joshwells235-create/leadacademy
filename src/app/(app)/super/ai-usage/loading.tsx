export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="h-7 w-32 rounded bg-neutral-100 animate-pulse" />
      <div className="mt-2 h-4 w-80 rounded bg-neutral-100 animate-pulse" />
      <div className="mt-6 h-10 rounded-md bg-neutral-100 animate-pulse" />
      <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="h-16 rounded-lg bg-neutral-100 animate-pulse" />
        ))}
      </div>
      <div className="mt-6 h-32 rounded-lg bg-neutral-100 animate-pulse" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-lg bg-neutral-100 animate-pulse" />
        <div className="h-80 rounded-lg bg-neutral-100 animate-pulse" />
      </div>
    </div>
  );
}
