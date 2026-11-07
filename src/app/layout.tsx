import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPL Cycle Tracker",
  description: "Four-gameweek mini-league standings for an FPL classic league",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
