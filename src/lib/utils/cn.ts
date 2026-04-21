// Tiny className joiner. Drops falsy values so conditional classes can
// be inlined without ternaries that collapse to empty strings.
//
// Intentionally not importing clsx — we don't need array or object
// inputs anywhere the app currently uses className merging, and
// avoiding the dep keeps the primitives zero-overhead.
export function cn(
  ...parts: Array<string | null | undefined | false>
): string {
  return parts.filter(Boolean).join(" ");
}
