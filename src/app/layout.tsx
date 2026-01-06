import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const ogImage = "/og-banner.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sonar Municipal - Sugestão de Políticas Públicas",
    template: "Sonar Municipal - %s",
  },
  description: "Busque por políticas públicas relevantes que podem ser aplicadas em seu município",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Sonar Municipal",
    title: "Sonar Municipal - Sugestão de Políticas Públicas",
    description: "Busque por políticas públicas relevantes que podem ser aplicadas em seu município",
    url: "/",
    images: [
      {
        url: ogImage,
        width: 4000,
        height: 1500,
        alt: "Sonar Municipal - Sugestão de Políticas Públicas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sonar Municipal - Sugestão de Políticas Públicas",
    description: "Busque por políticas públicas relevantes que podem ser aplicadas em seu município",
    images: [ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
