import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";
import "@/styles/theme.css";
import SwRegister from "./sw-register";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "מִשְׁמֶרֶת",
  description: "שיבוץ משמרות אוטומטי לצוותים",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#3457F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
