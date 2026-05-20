import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ScreenDeck",
  description: "Figma for screenshots — precision composer for App Store screenshots.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#07070a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Inline pre-hydration script — sets the data-theme attribute before the page
// paints, so a light-mode user on a fresh load doesn't see a flash of dark.
const themeInit = `
try {
  var m = localStorage.getItem('screendeck:theme');
  var sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  var eff = (m === 'light' || m === 'dark') ? m : sys;
  if (eff === 'light') document.documentElement.setAttribute('data-theme', 'light');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
