import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Rapport — Walk into every networking event ready",
  description: "Rapport researches who you'll meet, builds personalized talking points, and lets you practice with AI personas before the real thing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans antialiased bg-cream text-ink selection:bg-amber-400/20 selection:text-amber-900">
        {children}
      </body>
    </html>
  );
}
