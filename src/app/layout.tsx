import type { Metadata, Viewport } from "next";
import { Geist_Mono, Fira_Sans } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
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
  description: "Web app for Park Slope Food Coop members",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PSFC",
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
          <main className="min-h-screen pb-20 md:pb-0 md:pt-16">
            {children}
          </main>
          <Navigation />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
