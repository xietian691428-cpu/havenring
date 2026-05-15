import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";
import { ContrastToggle } from "./contrast-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { SupabaseUrlSessionBootstrap } from "./supabase-url-session-bootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const landingSerif = Cormorant_Garamond({
  variable: "--font-landing-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Haven Ring",
  description: "Seal a private moment with a touch of the ring.",
  applicationName: "Haven Ring",
  appleWebApp: {
    capable: true,
    title: "Haven",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${landingSerif.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white selection:bg-white selection:text-black high-contrast">
        <SupabaseUrlSessionBootstrap />
        <RegisterServiceWorker />
        <LanguageSwitcher />
        <ContrastToggle />
        {children}
      </body>
    </html>
  );
}
