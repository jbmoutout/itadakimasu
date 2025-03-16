"use client";

import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface HeaderProps {
  onLogout: () => void;
}

export const Header = ({ onLogout }: HeaderProps) => {
  const pathname = usePathname();

  return (
    <div className="h-12 flex items-center justify-between px-6 bg-white fixed left-0 right-0 top-0 z-50 ">
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="text-lg font-bold font-sans hover:text-gray-600"
        >
          itadakimasu
        </Link>
        <nav className="flex items-center">
          <Link
            href="/"
            className={`px-6 h-12 flex items-center border-b-2 text-sm ${
              pathname === "/"
                ? "border-black font-semibold"
                : "border-transparent text-gray-600 hover:text-black"
            }`}
          >
            Cooking
          </Link>
          <Link
            href="/recipes"
            className={`px-6 h-12 flex items-center border-b-2 text-sm ${
              pathname === "/recipes"
                ? "border-black font-semibold"
                : "border-transparent text-gray-600 hover:text-black"
            }`}
          >
            Recipes
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
};
