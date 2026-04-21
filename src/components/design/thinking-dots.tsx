import { TPOrb } from "./tp-orb";

// The "Thought Partner is thinking" indicator — orb + three pulsing
// dots on a 1.2s cycle with 0.15s stagger. Distinct from a skeleton
// or spinner; this is the AI's voice pausing, not a loading state.
export function ThinkingDots() {
  return (
    <div className="flex items-center gap-3.5">
      <TPOrb size={28} live />
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "var(--t-accent)",
              animation: "dotPulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
