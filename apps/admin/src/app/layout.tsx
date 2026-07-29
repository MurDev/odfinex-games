import type { Metadata } from "next";

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
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0f1419",
          color: "#e8eef3",
        }}
      >
        {children}
      </body>
    </html>
  );
}
