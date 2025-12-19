import { supabase } from "./_shared/supabaseClient.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Node-compatible hashing for Netlify
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    // 1. Find user
    const { data: user } = await supabase
      .from("onboard_requests")
      .select("*")
      .eq("email", email)
      .single();

    if (!user || !user.password_hash)
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid login" }) };

    // 2. Check password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid login" }) };

    // 3. Create session token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const token_hash = hashToken(rawToken);

    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // 4. Store in DB
    await supabase.from("user_sessions").insert({
      user_id: user.id,
      token_hash,
      expires_at: expires
    });

    // 5. Return raw token
    return {
      statusCode: 200,
      body: JSON.stringify({ token: rawToken })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" })
    };
  }
};

