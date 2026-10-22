import type { Metadata, Viewport } from "next";
import { Figtree, Gabarito } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

const gabarito = Gabarito({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-gabarito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "apalabra · Panel de negocios",
  description: "Panel financiero multi-salón",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "apalabra",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFF4F9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${figtree.variable} ${gabarito.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body>
        <div id="app-shell">{children}</div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
