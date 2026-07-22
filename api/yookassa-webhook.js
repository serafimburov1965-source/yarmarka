import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const event = req.body;
  if (!event || event.event !== "payment.succeeded") {
    return res.status(200).json({ ok: true });
  }

  const { ref, tier } = event.object?.metadata || {};
  if (!ref || !tier) {
    return res.status(200).json({ ok: true });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("profiles")
    .update({ subscription_tier: tier, subscription_until: until })
    .eq("ref", ref);

  return res.status(200).json({ ok: true });
}
