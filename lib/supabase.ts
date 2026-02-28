import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env vars:",
    "URL:", supabaseUrl ? "SET" : "MISSING",
    "KEY:", supabaseAnonKey ? "SET" : "MISSING"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
