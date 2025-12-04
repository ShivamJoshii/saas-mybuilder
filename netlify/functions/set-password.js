import { supabase } from "./_shared/supabaseClient.js";
import bcrypt from "bcryptjs";

export const handler = async (event) => {
  try {
    const { token, password } = JSON.parse(event.body);

    // 1. Validate token
    const { data: tokenRow, error } = await supabase
      .from("password_setup_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (!tokenRow || tokenRow.used)
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid token" }) };

    if (new Date(tokenRow.expires_at) < new Date())
      return { statusCode: 400, body: JSON.stringify({ error: "Token expired" }) };

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Update user
    await supabase
      .from("onboard_requests")
      .update({ password_hash: passwordHash })
      .eq("id", tokenRow.user_id);

    // 4. Mark token used
    await supabase
      .from("password_setup_tokens")
      .update({ used: true })
      .eq("id", tokenRow.id);

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};

