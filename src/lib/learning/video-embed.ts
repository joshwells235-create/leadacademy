/**
 * Resolve a raw video URL (YouTube / Vimeo / Loom) to an embeddable
 * iframe src. Returns null when the URL doesn't match a supported
 * provider — callers should surface a friendly "paste a YouTube, Vimeo,
 * or Loom link" error in that case rather than rendering a broken iframe.
 */
export type VideoProvider = "youtube" | "vimeo" | "loom";

export type ResolvedEmbed = {
  provider: VideoProvider;
  embedUrl: string;
};

export function resolveVideoEmbed(raw: string): ResolvedEmbed | null {
  const url = raw.trim();
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  // YouTube: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID.
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") {
      id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? null;
    } else if (parsed.pathname.startsWith("/watch")) {
      id = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      id = parsed.pathname.split("/embed/")[1]?.split("/")[0] ?? null;
    } else if (parsed.pathname.startsWith("/shorts/")) {
      id = parsed.pathname.split("/shorts/")[1]?.split("/")[0] ?? null;
    }
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
  }

  // Vimeo: /VIDEO_ID or /showcase/.../video/ID.
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const path = parsed.pathname.replace(/^\//, "");
    if (host === "player.vimeo.com" && path.startsWith("video/")) {
      const id = path.split("/")[1];
      if (id && /^\d+$/.test(id))
        return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    const videoIdMatch = path.match(/(?:^|\/)(\d+)(?:[/?]|$)/);
    if (videoIdMatch) {
      return {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${videoIdMatch[1]}`,
      };
    }
    return null;
  }

  // Loom: /share/UUID or /embed/UUID.
  if (host === "loom.com" || host === "www.loom.com") {
    const m = parsed.pathname.match(/\/(?:share|embed)\/([a-f0-9-]+)/i);
    if (m?.[1]) return { provider: "loom", embedUrl: `https://www.loom.com/embed/${m[1]}` };
    return null;
  }

  return null;
}

/** One-line human-readable description for embedding above the preview. */
export function providerLabel(provider: VideoProvider): string {
  return { youtube: "YouTube", vimeo: "Vimeo", loom: "Loom" }[provider];
}
