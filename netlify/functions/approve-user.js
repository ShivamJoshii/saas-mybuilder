// netlify/functions/approve-user.js
import { supabase } from "./_shared/supabaseClient.js";
import crypto from "crypto";

export const handler = async (event) => {
  try {
    const { email } = JSON.parse(event.body);

    // 1. Approve user (your schema uses "status")
    const { data: user, error: userError } = await supabase
      .from("onboard_requests")
      .update({ status: "approved" })
      .eq("email", email)
      .select()
      .single();

    if (userError || !user) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "User not found or update failed" })
      };
    }

    // 2. Create password setup token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    const { error: tokenError } = await supabase
      .from("password_setup_tokens")
      .insert({
        user_id: user.id,
        token,
        expires_at: expires,
        used: false
      });

    if (tokenError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Token creation failed" })
      };
    }

    // 3. Return setup link to admin
    const setupLink = `https://app.mybuilder.ca/setup-password?token=${token}`;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        setupLink
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" })
    };
  }
};
