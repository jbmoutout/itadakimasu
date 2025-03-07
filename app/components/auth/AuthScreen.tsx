import { Button } from "@/components/ui/button";
import Image from "next/image";
import Login from "./Login";
import Signup from "./Signup";
import { useState } from "react";

export const AuthScreen = () => {
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
          <h1 className="text-3xl">Itadakimasu</h1>
        </div>
      </div>
      <div className="mt-4">
        {showLogin ? <Login /> : <Signup />}
        <Button
          variant="link"
          className="mt-2"
          onClick={() => setShowLogin(!showLogin)}
        >
          {showLogin
            ? "Need an account? Sign up"
            : "Already have an account? Log in"}
        </Button>
      </div>
    </div>
  );
};
