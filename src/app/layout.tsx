import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import AskFlux from "@/components/AskFlux";
import DemoController from "@/components/DemoController";
import CommandPalette from "@/components/CommandPalette";
import SpatialWrapper from "@/components/SpatialWrapper";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-serif",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flux - AI Executive Assistant",
  description:
    "Flux securely connects to your Google Workspace to read Gmail and Google Calendar data. It automatically extracts action items, tracks commitments, and summarizes upcoming meetings to help you prepare for your day.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white selection:bg-[#00F0FF] selection:text-black">
        <SpatialWrapper>
          {children}
          {/* Demo Controller: floats top-center when Demo Mode is active */}
        <DemoController />
        {/* Ask Flux: Global AI overlay available on every page */}
        <AskFlux />
        {/* Global keyboard-driven command palette */}
        <CommandPalette />
        </SpatialWrapper>
      </body>
    </html>
  );
}
