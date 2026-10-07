import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bank Of School",
  description: "ระบบธนาคารโรงเรียน (Bank of School) - ระบบจัดการบัญชีออมทรัพย์นักเรียน",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative text-slate-100">
        {/* Full-screen Fixed Background Image */}
        <div
          className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: "url('/assets/images/school_bank_bg.png')" }}
          aria-hidden="true"
        />
        {/* Subtle Frosted Overlay for Center Readability */}
        <div
          className="fixed inset-0 -z-10 bg-slate-950/45 backdrop-blur-[2px] backdrop-brightness-95 pointer-events-none"
          aria-hidden="true"
        />
        {children}
      </body>
    </html>
  );
}
