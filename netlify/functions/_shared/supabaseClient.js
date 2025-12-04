import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const supabaseServiceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error("Missing Supabase environment variables for backend.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { persistSession: false }
});
