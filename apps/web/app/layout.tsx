import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3020";

const DESCRIPTION =
  "Finder is an AI-powered discovery network that tells you what is in stock, how much, at what price, and from the nearest vendor — in real time.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Finder — Real-time inventory discovery",
    template: "%s · Finder",
  },
  description: DESCRIPTION,
  applicationName: "Finder Network",
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "Finder",
    title: "Finder — Real-time inventory discovery",
    description: DESCRIPTION,
    images: ["/opengraph.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Finder — Real-time inventory discovery",
    description: DESCRIPTION,
    images: ["/opengraph.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#060d1f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
