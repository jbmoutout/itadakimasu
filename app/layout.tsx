import "./globals.css";
import { Inter } from "next/font/google";
import { SidePanel } from "./components/layout/SidePanel";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Itadakimasu - Recipe Manager",
  description: "Manage your recipes and ingredients",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <SidePanel />
      </body>
    </html>
  );
}
