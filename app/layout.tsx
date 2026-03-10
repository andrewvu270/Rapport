import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "NetWork - AI Networking Coach",
  description: "Practice professional networking conversations with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-[#09090b] text-zinc-50 selection:bg-violet-500/30 selection:text-violet-200">
        {children}
      </body>
    </html>
  );
}
