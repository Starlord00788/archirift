import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { NavBar } from "@/components/shell/NavBar";
import { Providers } from "@/components/shell/Providers";
import { buildCatalog } from "@/content/catalog";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Archirift: learn system design by playing", template: "%s · Archirift" },
  description:
    "A free game for learning low-level and high-level system design: design patterns, SOLID, scaling, databases, queues and interview case studies. Build systems, break them and seal the rifts.",
  applicationName: "Archirift",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b16" },
    { media: "(prefers-color-scheme: light)", color: "#f4f7fc" },
  ],
};

// Applies the saved theme before the first paint, so there is no flash of the wrong colours.
const themeScript = `try{var t=localStorage.getItem("archirift:theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const catalog = buildCatalog();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <div className="app-backdrop" aria-hidden="true" />
        <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <Providers catalog={catalog}>
          <NavBar />
          <div className="pb-20 md:pb-0">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
