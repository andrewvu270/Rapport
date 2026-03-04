import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
