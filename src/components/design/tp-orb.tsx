import { cn } from "@/lib/utils/cn";

// The Thought Partner's visual signature — a radial-gradient orb with a
// highlight spot. "Live" orbs breathe (hero + thinking state); still
// orbs render inside messages, inline lesson callouts, and anywhere the
// TP is referenced without actively speaking.
//
// Critical: renders identically in Editorial and Cinematic via CSS
// variables (--t-orb, --t-orb-shadow). Do not reach for a prop-based
// gradient override — the theme system is the source of truth.
export function TPOrb({
  size = 28,
  live = false,
  className,
}: {
  size?: number;
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: "var(--t-orb)",
        boxShadow: "var(--t-orb-shadow)",
        animation: live ? "breathe 4s ease-in-out infinite" : undefined,
      }}
      className={cn("relative shrink-0", className)}
    >
      {/* Highlight spot — positioned as a percentage so it scales with
          the orb. Keep this inside the orb; don't extract it to a pseudo
          element, which would make `size` math awkward. */}
      <div
        className="absolute rounded-full bg-white/50"
        style={{
          top: "15%",
          left: "20%",
          width: "25%",
          height: "15%",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}
