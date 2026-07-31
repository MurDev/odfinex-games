import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin — Odfinex Games",
  description: "Operations console for Odfinex Games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
