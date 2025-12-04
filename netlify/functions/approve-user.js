import { supabase } from "./_shared/supabaseClient.js";
import crypto from "crypto";

export const handler = async (event) => {
  try {
    const { email } = JSON.parse(event.body);

    // 1. Mark user as approved
    const { data: user, error: userError } = await supabase
      .from("onboard_requests")
      .update({ approved: true })
      .eq("email", email)
      .select()
      .single();

    if (userError || !user)
      return { statusCode: 400, body: JSON.stringify({ error: "User not found" }) };

    // 2. Create a secure token
    const token = crypto.randomBytes(32).toString("hex");

    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    await supabase.from("password_setup_tokens").insert({
      user_id: user.id,
      token,
      expires_at: expires
    });

    // 3. Send email (pseudo — I can build real email next)
    // You plug this into Resend / Mailgun / SendGrid etc.
    console.log(`SEND EMAIL TO USER WITH URL: https://yourapp.com/setup-password?token=${token}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        setupLink: `https://yourapp.com/setup-password?token=${token}`
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};

