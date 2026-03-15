import type { Metadata } from "next";
import { Figtree, Noto_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import ErrorBoundary from "@/components/ErrorBoundary";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CliniqAI — Doctor Dashboard",
  description: "AI-powered clinical decision support for Indian doctors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${notoSans.variable}`}>
      <body className="font-body text-foreground bg-background">
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
