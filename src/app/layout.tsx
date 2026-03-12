import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastRoot } from "@/shared/ui/Toaster";
import "@/shared/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MAF Speaker",
  description: "MAF Speaker Client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ToastRoot>{children}</ToastRoot>
      </body>
    </html>
  );
}
