export default function LoadingConversation() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="h-3 w-32 rounded bg-neutral-100 animate-pulse" />
      <div className="mt-5 h-7 w-72 rounded bg-neutral-100 animate-pulse" />
      <div className="mt-2 h-4 w-52 rounded bg-neutral-100 animate-pulse" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="h-24 rounded-lg bg-neutral-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
