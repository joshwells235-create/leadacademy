// The Cinematic-only ambient aurora. Three absolute-positioned blobs
// drifting behind the app chrome. Contained to a `position: relative;
// overflow: hidden` parent (typically the app-layout root).
//
// Always mount this in authenticated layouts and let CSS gate its
// visibility via `data-theme` on <html>. That way a client-side theme
// flip (which just swaps the data-theme attribute) fades the glow
// in/out without a server round-trip. Invisible in Editorial; lit in
// Cinematic.
export function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="ambient-glow pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-500"
      style={{ zIndex: 0 }}
    >
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "70%",
          height: "80%",
          background:
            "radial-gradient(circle, rgba(234,12,103,0.22), transparent 60%)",
          filter: "blur(60px)",
          animation: "drift1 20s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20%",
          right: "-10%",
          width: "60%",
          height: "70%",
          background:
            "radial-gradient(circle, rgba(0,126,250,0.18), transparent 60%)",
          filter: "blur(60px)",
          animation: "drift2 24s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          left: "20%",
          width: "60%",
          height: "60%",
          background:
            "radial-gradient(circle, rgba(16,29,81,0.5), transparent 60%)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}
