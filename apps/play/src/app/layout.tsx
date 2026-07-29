import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play — Odfinex Games",
  description: "Game session surface for Odfinex Games",
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
            "radial-gradient(1000px 500px at 90% 10%, #2a1f12 0%, #0b1218 50%, #070b10 100%)",
          color: "#e8eef3",
        }}
      >
        {children}
      </body>
    </html>
  );
}
