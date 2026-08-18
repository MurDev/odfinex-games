import type { Metadata } from "next";
import Header from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL || "https://odfinex-web.vercel.app"),
  title: "Odfinex Games",
  description: "Plateforme et catalogue de jeux Odfinex Games",
  openGraph: {
    title: "Odfinex Games",
    description: "La plateforme et le catalogue de jeux Odfinex.",
    siteName: "Odfinex Games",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Odfinex Games" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Odfinex Games",
    description: "La plateforme et le catalogue de jeux Odfinex.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
