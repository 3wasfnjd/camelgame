import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "جمل الصحراء",
  description: "استكشف صحراء ثلاثية الأبعاد، وابحث عن الماء والطعام، واكتشف الواحات والآثار القديمة.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
