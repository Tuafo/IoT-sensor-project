import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Monitoramento Ambiental IoT com HBase",
  description: "Dashboard acadêmico com Apache HBase, FastAPI e Next.js.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
