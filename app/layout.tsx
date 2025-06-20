import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AmplifyProvider from "./amplify-provider";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/contexts/SessionContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vision RAG",
  description: "Upload and search PDFs and PowerPoint files with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AmplifyProvider>
          <SessionProvider>
            {children}
            <Toaster />
          </SessionProvider>
        </AmplifyProvider>
      </body>
    </html>
  );
}
