import { useState } from "react";
import { Link } from 'react-router-dom';
import { supabase } from "./lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import './index.css';

// Hash token using Web Crypto API (browser-compatible)
async function hashToken(raw) {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("");

    // 1. Check if email exists AND approved
    const { data: user, error } = await supabase
      .from("onboard_requests")
      .select("*")
      .eq("email", email)
      .eq("status", "approved")
      .single();

    if (error || !user) {
      setLoading(false);
      setMessage("Your account is not approved yet.");
      setMessageType("error");
      return;
    }

    // 2. Generate raw token
    const rawToken = uuidv4() + uuidv4();

    // 3. Hash the token
    const tokenHash = await hashToken(rawToken);

    // 4. Insert hashed token into DB
    const { error: sessionError } = await supabase.from("user_sessions").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    if (sessionError) {
      console.error(sessionError);
      setLoading(false);
      setMessage("Something went wrong creating session.");
      setMessageType("error");
      return;
    }

    // 5. Store ONLY the raw token locally
    localStorage.setItem("session_token", rawToken);

    // 5. Redirect to dashboard
    window.location.href = "/dashboard";

    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--background)'
    }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
        <h1 style={{ 
          fontSize: '1.875rem', 
          fontWeight: '600', 
          marginBottom: '0.5rem',
          color: 'var(--foreground)'
        }}>
          Login
        </h1>
        <p style={{ 
          color: 'var(--muted-foreground)', 
          marginBottom: '2rem',
          fontSize: '0.875rem'
        }}>
          Access your clinic dashboard.
        </p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="label">
              Email
            </label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <button
            type="submit"
            className="button"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {message && (
          <div className={`message ${messageType}`} style={{ marginTop: '1rem' }}>
            {message}
          </div>
        )}

        <p style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--muted-foreground)'
        }}>
          Don't have an account?{' '}
          <Link to="/request-access" className="link">
            Request Access
          </Link>
        </p>
      </div>
    </div>
  );
}

