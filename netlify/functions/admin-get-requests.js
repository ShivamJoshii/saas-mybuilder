import { supabase } from "./_shared/supabaseClient.js";

export const handler = async () => {
  try {
    // Get ALL users where status is null or not approved
    const { data, error } = await supabase
      .from("onboard_requests")
      .select("*")
      .or("status.is.null,status.eq.pending,status.eq.requested");

    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data || [])
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error in admin-get-requests" })
    };
  }
};
