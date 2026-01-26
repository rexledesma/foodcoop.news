import type { Metadata, Viewport } from "next";
import { Geist_Mono, Fira_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · foodcoop.news",
    default: "foodcoop.news",
  },
  description: "Stay in the loop with the Park Slope Food Coop.",
  metadataBase: new URL("https://foodcoop.news"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PSFC",
  },
  openGraph: {
    title: "foodcoop.news",
    description: "Stay in the loop with the Park Slope Food Coop.",
    url: "/",
    siteName: "foodcoop.news",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "📰 foodcoop.news",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "foodcoop.news",
    description: "Stay in the loop with the Park Slope Food Coop.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4A6741",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistMono.variable} ${firaSans.variable} antialiased bg-zinc-50 dark:bg-zinc-950`}
      >
        <ConvexClientProvider>
          <div
            className="fixed top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0693e3]/10 via-[#00d084]/10 to-transparent pointer-events-none z-30"
            aria-hidden="true"
          />
          <div className="flex flex-col min-h-screen">
            <main className="pt-16 md:pt-14">{children}</main>
            <Footer />
          </div>
          <Navigation />
        </ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
