import type { Metadata } from "next";
import { connection } from "next/server";
import { getBranding } from "@/lib/branding";
import { Geist, Geist_Mono } from "next/font/google";
import IframeResize from "@/components/iframe-resize";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { name } = await getBranding();
  return {
    title: `Members | ${name}`,
    description: `Loyalty, appointments, and referrals for ${name} members.`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <IframeResize />
        {children}
      </body>
    </html>
  );
}
