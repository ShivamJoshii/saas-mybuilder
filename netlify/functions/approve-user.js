import { supabase } from "./_shared/supabaseClient.js";
import crypto from "crypto";
import nodemailer from "nodemailer";

export const handler = async (event) => {
  try {
    const { email } = JSON.parse(event.body);

    // 1. Approve user
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

    // 2. Create token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 86400000); // 24 hours

    await supabase.from("password_setup_tokens").insert({
      user_id: user.id,
      token,
      expires_at: expires,
      used: false
    });

    const setupLink = `https://app.mybuilder.ca/setup-password?token=${token}`;

    // 3. Send email using Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"MyBuilder" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Set up your MyBuilder account",
      html: `
        <h2>Welcome to MyBuilder</h2>
        <p>Your account has been approved.</p>
        <p>Click below to set your password:</p>
        <a href="${setupLink}">${setupLink}</a>
        <br/><br/>
        <p>This link expires in 24 hours.</p>
      `
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        setupLink
      })
    };

  } catch (err) {
    console.log("EMAIL ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" })
    };
  }
};
