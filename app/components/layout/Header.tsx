import { Button } from "@/components/ui/button";

interface HeaderProps {
  onLogout: () => void;
}

export const Header = ({ onLogout }: HeaderProps) => {
  return (
    <div className="flex align-middle justify-between fixed left-0 right-0 top-0 px-10 bg-white z-50 pt-4">
      <div className="flex align-middle gap-2">
        <p className="text-lg font-bold font-sans">itadakimasu</p>
      </div>
      <div className="flex justify-between items-center mb-4 gap-2">
        <Button variant="ghost" onClick={onLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
};
