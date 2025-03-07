import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log("Login successful, received token:", data.token);

        // Store token in localStorage for the web app
        localStorage.setItem("token", data.token);
        console.log("Token stored in localStorage");

        // Send message to Chrome extension
        if (typeof chrome !== "undefined" && chrome.runtime) {
          console.log("Chrome runtime is available");
          try {
            // Get the extension ID from the extension's URL
            const extensionId = "ncanpfbihbjlnjiflandmafgddnpcmfe"; // You'll need to replace this with your actual extension ID
            console.log("Sending message to extension:", extensionId);

            // Send message to the extension
            chrome.runtime.sendMessage(
              extensionId,
              { type: "ITADAKIMASU_LOGIN", token: data.token },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Failed to send message to extension:",
                    chrome.runtime.lastError
                  );
                } else {
                  console.log(
                    "Message sent to extension successfully:",
                    response
                  );
                }
              }
            );
          } catch (error) {
            console.error("Error sending message to extension:", error);
          }
        } else {
          console.log("Chrome runtime is not available");
        }

        onLogin();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred during login");
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="mt-2 w-96"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        className="mt-2 w-96"
      />
      <Button type="submit" className="mt-2">
        Login
      </Button>
    </form>
  );
};

export default Login;
