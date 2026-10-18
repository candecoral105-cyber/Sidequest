// Page shell shared by every screen: fonts, title, theme colour and light/dark start-up.
import type { Metadata, Viewport } from "next";
// Fonts are bundled from npm (no internet needed at the venue).
import "@fontsource-variable/bricolage-grotesque/standard.css"; // weight + width axes
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SideQuest",
  description: "Turn the gaps between your classes into something worth doing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f1d" },
  ],
};

// Runs before the page draws, so dark mode never flashes white. Same rule as src/lib/theme.ts ("sq-theme-v1").
const THEME_BOOT = `try{var c=localStorage.getItem("sq-theme-v1");var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The start-up script sets data-theme before React loads, so React mustn't complain that it differs.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
