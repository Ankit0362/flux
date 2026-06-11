import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";
import AskChiefOS from "@/components/AskChiefOS";
import DemoController from "@/components/DemoController";
import CommandPalette from "@/components/CommandPalette";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChiefOS - Email-driven cognitive assistant",
  description:
    "ChiefOS turns your raw Gmail stream into actionable, auto-tracked commitments and follow-ups. Built for busy operators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Demo Controller: floats top-center when Demo Mode is active */}
        <DemoController />
        {/* Ask ChiefOS: Global AI overlay available on every page */}
        <AskChiefOS />
        {/* Global keyboard-driven command palette */}
        <CommandPalette />
      </body>
    </html>
  );
}
