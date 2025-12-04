import { supabase } from "./_shared/supabaseClient.js";

export const handler = async () => {
  const { data, error } = await supabase
    .from("onboard_requests")
    .select("*")
    .eq("approved", false);

  if (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};

