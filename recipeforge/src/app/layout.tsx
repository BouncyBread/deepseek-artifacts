import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Source_Serif_4 } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-recipe",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RecipeForge — AI Cookbook",
  description: "Generate beautiful, authentic recipes with AI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RecipeForge",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#b8442a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background">
        <TooltipProvider>
          {children}
          <Toaster position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
