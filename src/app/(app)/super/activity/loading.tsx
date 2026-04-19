export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-7 w-56 rounded bg-neutral-100 animate-pulse" />
      <div className="mt-2 h-4 w-[34rem] max-w-full rounded bg-neutral-100 animate-pulse" />
      <div className="mt-6 h-10 rounded-md bg-neutral-100 animate-pulse" />
      <div className="mt-4 h-96 rounded-lg bg-neutral-100 animate-pulse" />
    </div>
  );
}
