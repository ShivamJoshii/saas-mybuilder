import { useState } from "react";
import { Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("error");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    const res = await fetch("/.netlify/functions/login-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.error) {
      setMsg(data.error);
      setMsgType("error");
      setLoading(false);
      return;
    }

    localStorage.setItem("session_token", data.token);
    window.location.href = "/dashboard";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        padding: "2rem"
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: "420px" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>
          Welcome back
        </h1>

        <p style={{ color: "var(--muted-foreground)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Enter your credentials to access your dashboard.
        </p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              placeholder="you@clinic.com"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="button"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {msg && (
          <div className={`message ${msgType}`} style={{ marginTop: "1rem" }}>
            {msg}
          </div>
        )}

        <p
          style={{
            marginTop: "1.5rem",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--muted-foreground)"
          }}
        >
          Don’t have an account?{" "}
          <Link to="/request-access" className="link">
            Request Access
          </Link>
        </p>
      </div>
    </div>
  );
}
