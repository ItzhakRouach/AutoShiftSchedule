import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";
import "@/styles/theme.css";
import SwRegister from "./sw-register";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
});

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "מִשְׁמֶרֶת — שיבוץ משמרות אוטומטי",
  description: "שיבוץ משמרות אוטומטי לצוותים לפי בקשות, תפקידים וזמני מנוחה",
  manifest: "/manifest.webmanifest",
  applicationName: "מִשְׁמֶרֶת",
  // og:image is supplied automatically by src/app/opengraph-image.tsx so shared
  // invite links render the app's own branded preview card (not a generic
  // deployment-host preview).
  openGraph: {
    title: "מִשְׁמֶרֶת — שיבוץ משמרות אוטומטי",
    description: "שיבוץ משמרות אוטומטי לצוותים לפי בקשות, תפקידים וזמני מנוחה",
    siteName: "מִשְׁמֶרֶת",
    locale: "he_IL",
    type: "website",
  },
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
        {/* Apply the saved theme before paint to avoid a flash (default = light). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t&&t!=='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
          }}
        />
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
