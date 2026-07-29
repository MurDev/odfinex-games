import type { Metadata } from "next";
import Header from "@/components/header";

export const metadata: Metadata = {
  title: "Odfinex Games",
  description: "Catalogue and player hub for Odfinex Games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background:
            "radial-gradient(1200px 600px at 10% 0%, #1a3a4a 0%, #0b1218 55%, #070b10 100%)",
          color: "#e8eef3",
        }}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}
