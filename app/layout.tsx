import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Desert Camel",
  description: "Explore a living stylized desert as a camel. Find water, survive the heat, and uncover ancient ruins.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
