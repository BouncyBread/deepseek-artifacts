import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
const vars = {};
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)/);
  if (m) vars[m[1]] = m[2];
}

const supabase = createClient(vars.SUPABASE_URL, vars.SUPABASE_SERVICE_KEY);

// Create table via REST (Supabase auto-creates from first insert)
const { error } = await supabase.from("recipe_requests").insert({
  id: "00000000-0000-0000-0000-000000000000",
  prompt: "_migration_seed_",
  status: "pending",
});

if (error) {
  // Table might already exist, check the error
  if (error.message.includes("does not exist")) {
    console.log("Table doesn't exist yet. Creating via SQL API...");
    // Try to create via direct SQL
    const res = await fetch(
      `${vars.SUPABASE_URL}/rest/v1/`,
      { headers: { apikey: vars.SUPABASE_SERVICE_KEY } }
    );
    console.log("Status:", res.status);
  } else {
    console.log("Error:", error.message);
  }
} else {
  console.log("Table exists (insert succeeded)");
  // Clean up seed row
  await supabase.from("recipe_requests").delete().eq("id", "00000000-0000-0000-0000-000000000000");
}
