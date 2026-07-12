import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inclusive AI Trust Gateway",
  description:
    "Public-service AI evaluation and protection platform: inclusion auditing before launch, agent safety during operation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main id="app">{children}</main>
      </body>
    </html>
  );
}
