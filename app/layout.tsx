import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";
import { ContrastToggle } from "./contrast-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { SupabaseUrlSessionBootstrap } from "./supabase-url-session-bootstrap";
import { inter } from "./fonts-inter";
import { isIosWebKitUserAgent } from "@/lib/composer-platform-limits";

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

async function resolveFontClasses(): Promise<{ className: string; iosMinimal: boolean }> {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const iosMinimal = isIosWebKitUserAgent(userAgent);
  if (iosMinimal) {
    return { className: `${inter.variable} ios-font-minimal`, iosMinimal: true };
  }
  const { geistSans, geistMono, landingSerif } = await import("./fonts-marketing");
  return {
    className: `${geistSans.variable} ${geistMono.variable} ${landingSerif.variable} ${inter.variable}`,
    iosMinimal: false,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { className: fontClasses, iosMinimal } = await resolveFontClasses();

  return (
    <html lang="en" className={`${fontClasses} h-full antialiased`} data-ios-font={iosMinimal ? "minimal" : undefined}>
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
