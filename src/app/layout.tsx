import type { Metadata } from "next";
import { Fraunces, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getServerThemeMode } from "@/lib/design/server-theme";
import { DEFAULT_THEME_MODE } from "@/lib/design/tokens";

// Primary UI + body face. Loaded for every page; lighter than the
// display serif.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display + body-emphasis serif. Used for greetings, panel titles,
// Thought-Partner messages, lesson headings. Preload — it's above the
// fold on the dashboard.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

// Accent italic — paired with accent color for the signature "italicised
// phrase in pink/hot-pink" pattern. Always used with <AccentWord>.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

// Metadata voice — uppercase mono labels throughout the app.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "Leadership Academy", template: "%s — Leadership Academy" },
  description: "Leadership development platform by LeadShift",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Hydrate data-theme from profile (or default) so first paint lands in
  // the right theme without a flash. Unauthenticated routes fall through
  // to the default editorial theme.
  const themeMode = (await getServerThemeMode()) ?? DEFAULT_THEME_MODE;

  return (
    <html
      lang="en"
      data-theme={themeMode}
      className={`${inter.variable} ${fraunces.variable} ${instrumentSerif.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: Grammarly + similar browser extensions
          inject `data-gr-*` attributes onto <body> between server render
          and hydration, which React (correctly) flags as a mismatch.
          Suppressing at the body level only masks attribute-level diffs;
          any real content mismatch still surfaces. */}
      <body className="min-h-full bg-bg text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
