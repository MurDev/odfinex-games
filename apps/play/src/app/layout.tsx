import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Play — Odfinex Games",
  description: "Lobby de jeux Odfinex Games",
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
