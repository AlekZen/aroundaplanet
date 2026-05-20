import type { Metadata, Viewport } from "next";
import { Inter, Poppins, Roboto_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthInitializer } from "@/components/shared/AuthInitializer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AroundaPlanet - Viajes Increibles",
    template: "%s | AroundaPlanet",
  },
  description:
    "Plataforma digital de AroundaPlanet. Vuelta al Mundo en 33.8 dias y mas destinos increibles.",
  keywords: ["viajes", "vuelta al mundo", "AroundaPlanet", "agencia de viajes"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "AroundaPlanet",
    title: "AroundaPlanet - Viajes Increibles",
    description: "Vuelta al Mundo en 33.8 dias y mas destinos increibles.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AroundaPlanet Travel Agency",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AroundaPlanet - Viajes Increibles",
    description: "Vuelta al Mundo en 33.8 dias y mas destinos increibles.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1B4332",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${poppins.variable} ${robotoMono.variable} antialiased`}
      >
        {children}
        <AuthInitializer />
        <Toaster />
      </body>
    </html>
  );
}
