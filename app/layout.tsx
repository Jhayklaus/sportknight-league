import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SportKnight League",
  description:
    "Home & away league — live table, fixtures, results and top scorers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
