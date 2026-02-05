import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mentioned — AI Visibility Checker",
  description: "Find out if ChatGPT and Claude mention your product when customers ask for tools like yours. Check your AI visibility, understand why, and get an action plan.",
  keywords: ["AI visibility", "ChatGPT", "Claude", "brand visibility", "SaaS marketing", "AI recommendations"],
  authors: [{ name: "Mentioned" }],
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Mentioned — AI Visibility Checker",
    description: "Find out if AI tools recommend your SaaS brand when customers ask for products like yours.",
    type: "website",
    siteName: "Mentioned",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Mentioned Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mentioned — AI Visibility Checker",
    description: "Find out if AI tools recommend your SaaS brand when customers ask for products like yours.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
