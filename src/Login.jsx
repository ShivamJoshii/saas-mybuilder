import { useState } from "react";
import { Link } from 'react-router-dom';
import { supabase } from "./lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import './index.css';

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

    // 2. Generate session token
    const token = uuidv4() + uuidv4(); // long, unique

    // 3. Insert session into database
    const { error: sessionError } = await supabase.from("sessions").insert({
      user_id: user.id,
      session_token: token,
    });

    if (sessionError) {
      console.error(sessionError);
      setLoading(false);
      setMessage("Something went wrong creating session.");
      setMessageType("error");
      return;
    }

    // 4. Store token locally
    localStorage.setItem("session_token", token);

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

