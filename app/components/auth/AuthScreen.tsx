import { Button } from "@/components/ui/button";
import Image from "next/image";
import Login from "./Login";
import Signup from "./Signup";
import { useState } from "react";

interface AuthScreenProps {
  onLogin: () => void;
}

export const AuthScreen = ({ onLogin }: AuthScreenProps) => {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="p-10">
      <div className="flex align-middle justify-between">
        <div className="flex align-middle gap-2">
          <Image
            src="/images/udon.png"
            alt="udon"
            width={30}
            height={0}
            style={{ width: "30px", height: "auto" }}
          />
          <p className="text-lg font-bold font-sans">itadakimasu</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        {showLogin ? (
          <Login onLogin={onLogin} />
        ) : (
          <Signup onSignup={onLogin} />
        )}
        <Button
          variant="ghost"
          onClick={() => setShowLogin(!showLogin)}
          className="mt-4"
        >
          {showLogin
            ? "Don't have an account? Sign up"
            : "Already have an account? Log in"}
        </Button>
      </div>
    </div>
  );
};
