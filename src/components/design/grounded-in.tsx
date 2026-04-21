import { MonoLabel } from "./mono-label";

// Renders the "grounded in · X · Y · Z" strip that appears under every
// Thought Partner message and above every TP chat panel. It's the
// brand's transparency gesture — shows at a glance what context the TP
// is reading from, without requiring the learner to open the full
// transparency modal.
//
// Pass the source labels in priority order (most recent / most relevant
// first). The component clips at 5 and renders "·" separators.
export function GroundedIn({
  sources,
  label = "Grounded in",
  className,
}: {
  sources: string[];
  label?: string;
  className?: string;
}) {
  if (sources.length === 0) return null;
  return (
    <MonoLabel tone="faint" className={className}>
      {label} · {sources.slice(0, 5).join(" · ")}
    </MonoLabel>
  );
}
