import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SportKnight League",
  description:
    "Run a home & away league — live table, fixtures, stats, seasons and a hall of fame.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
