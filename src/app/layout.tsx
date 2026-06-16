import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import AskChiefOS from "@/components/AskChiefOS";
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
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white selection:bg-[#00F0FF] selection:text-black">
        <SpatialWrapper>
          {children}
          {/* Demo Controller: floats top-center when Demo Mode is active */}
        <DemoController />
        {/* Ask ChiefOS: Global AI overlay available on every page */}
        <AskChiefOS />
        {/* Global keyboard-driven command palette */}
        <CommandPalette />
        </SpatialWrapper>
      </body>
    </html>
  );
}
