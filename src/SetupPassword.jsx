import { useState, useEffect } from "react";

export default function SetupPassword() {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const t = urlParams.get("token");
    setToken(t);
  }, []);

  const submitPassword = async () => {
    if (password !== confirmed) {
      setStatus("Passwords do not match");
      return;
    }

    const res = await fetch("/.netlify/functions/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });

    const data = await res.json();

    if (data.error) {
      setStatus(data.error);
      return;
    }

    setStatus("Password set! You may now log in.");
  };

  return (
    <div>
      <h2>Set Your Password</h2>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        type="password"
        placeholder="Confirm password"
        value={confirmed}
        onChange={(e) => setConfirmed(e.target.value)}
      />

      <button onClick={submitPassword}>Save Password</button>

      <p>{status}</p>
    </div>
  );
}


