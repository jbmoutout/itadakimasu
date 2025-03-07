import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SignupProps {
  onSignup: () => void;
}

const Signup = ({ onSignup }: SignupProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        onSignup();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Signup error:", error);
      alert("An error occurred during signup");
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <Button type="submit">Sign Up</Button>
    </form>
  );
};

export default Signup;
