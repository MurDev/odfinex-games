import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PLAY_URL || "https://odfinex-play.vercel.app"),
  title: "Odfinex Games : Catalogue",
  description: "Lobby de jeux Odfinex Games",
  openGraph: {
    title: "Odfinex Games",
    description: "Le catalogue de jeux Odfinex.",
    siteName: "Odfinex Games",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Odfinex Games" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Odfinex Games",
    description: "Le catalogue de jeux Odfinex.",
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
      <body>{children}</body>
    </html>
  );
}
