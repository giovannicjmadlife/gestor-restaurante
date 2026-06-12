import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestor Restaurante",
  description: "Sistema de gestão para restaurante",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}