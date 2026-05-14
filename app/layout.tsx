import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
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
  themeColor: "#000000",
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
      className={`${geistSans.variable} ${geistMono.variable} ${landingSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white selection:bg-white selection:text-black high-contrast">
        <Script id="haven-www-apex-hash" strategy="beforeInteractive">
          {`(function(){try{var h=location.hostname.toLowerCase();if(h!=="www.havenring.me")return;var p=location.pathname||"";if(/^\\/(app|hub|bind-ring|vault)(\\/|$)/.test(p))return;var ha=location.hash||"";if(ha.indexOf("access_token=")>=0||ha.indexOf("error=")>=0||ha.indexOf("error_description=")>=0)return;var t="https://havenring.me"+p+location.search+ha;if(location.href!==t)location.replace(t);}catch(e){}})();`}
        </Script>
        <SupabaseUrlSessionBootstrap />
        <RegisterServiceWorker />
        <LanguageSwitcher />
        <ContrastToggle />
        {children}
      </body>
    </html>
  );
}
