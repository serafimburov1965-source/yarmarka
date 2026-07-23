// Webhook от ЮKassa: приходит уведомление об успешной оплате, мы активируем подписку.
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const event = req.body;
  if (!event || event.event !== "payment.succeeded") {
    return res.status(200).json({ ok: true }); // игнорируем остальные события
  }

  const { ref, tier, purpose, listingId } = event.object?.metadata || {};
  if (!ref) {
    return res.status(200).json({ ok: true });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // секретный ключ, только на сервере, обходит RLS
  );

  if (tier) {
    const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("profiles").update({ subscription_tier: tier, subscription_until: until }).eq("ref", ref);
  } else if (purpose && listingId) {
    if (purpose === "boost_top") {
      await supabase.from("listings").update({ bumped_at: new Date().toISOString() }).eq("id", listingId);
    } else if (purpose === "boost_vip") {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("listings").update({ author_vip: true, boost_vip_until: until }).eq("id", listingId);
    } else if (purpose === "boost_promote") {
      const until = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("listings").update({ promoted_until: until }).eq("id", listingId);
    }
  }

  return res.status(200).json({ ok: true });
}
