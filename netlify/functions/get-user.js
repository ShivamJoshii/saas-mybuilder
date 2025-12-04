import { supabase } from "./_shared/supabaseClient.js";
import crypto from "crypto";

// Node-compatible hashing for Netlify
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const handler = async (event) => {
  try {
    const { token } = JSON.parse(event.body);

    // Hash the token before looking it up
    const token_hash = hashToken(token);

    // Find session
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("token_hash", token_hash)
      .single();

    if (sessionError || !session) {
      return { statusCode: 200, body: JSON.stringify(null) };
    }

    // Find user
    const { data: user } = await supabase
      .from("onboard_requests")
      .select("*")
      .eq("id", session.user_id)
      .single();

    return {
      statusCode: 200,
      body: JSON.stringify({
        email: user.email,
        name: user.name
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify(null)
    };
  }
};

