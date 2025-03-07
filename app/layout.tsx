import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Itadakimasu",
  description: "miam miam",
  icons: {
    icon: [
      { url: "/images/favicon.ico" },
      { url: "/images/favicon.ico", sizes: "16x16" },
      { url: "/images/favicon.ico", sizes: "32x32" },
    ],
    apple: [{ url: "/images/favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
