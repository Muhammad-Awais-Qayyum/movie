import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MovieBox Downloader",
  description: "Search and download movies, series, and music",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
