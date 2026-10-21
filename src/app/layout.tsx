import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { NavBar } from "@/components/shell/NavBar";
import { Providers } from "@/components/shell/Providers";
import { buildCatalog } from "@/content/catalog";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Headings: a grotesque with some character, so the type has a voice of its own.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Archirift: learn system design by playing", template: "%s · Archirift" },
  description:
    "A free game for learning low-level and high-level system design: design patterns, SOLID, scaling, databases, queues and interview case studies. Build systems, break them and seal the rifts.",
  applicationName: "Archirift",
  metadataBase: new URL("https://archirift.vercel.app"),
  openGraph: {
    type: "website",
    siteName: "Archirift",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Archirift: learn system design like it's a game. Fix what breaks, remember it, watch your city grow." }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0a" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
  ],
};

// Applies the saved theme before the first paint, so there is no flash of the wrong colours, and
// marks returning learners so the home page opens on their workspace rather than the hero.
const themeScript = `try{var t=localStorage.getItem("archirift:theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);if(localStorage.getItem("archirift:returning"))document.documentElement.setAttribute("data-returning","")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const catalog = buildCatalog();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${bricolage.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <div className="app-backdrop" aria-hidden="true" />
        <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <Providers catalog={catalog}>
          <NavBar />
          <div className="pb-24 lg:pb-0">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
