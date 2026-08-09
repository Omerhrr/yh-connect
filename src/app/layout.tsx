import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/site/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YH Connect, Hire Verified Construction Professionals",
  description:
    "YH Connect connects clients with verified Nigerian architects, engineers, contractors and construction trades. Post projects, find professionals, collaborate and pay securely.",
  manifest: "/manifest.json",
  applicationName: "YH Connect",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "YH Connect",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#013156",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the persisted theme before first paint to avoid a
            light-mode flash on load. Must stay in sync with the zustand
            persist storage key/shape in src/store/theme.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem("yhc-theme");if(raw){var theme=JSON.parse(raw).state.theme;if(theme==="dark")document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
        <PwaRegister />
      </body>
    </html>
  );
}
