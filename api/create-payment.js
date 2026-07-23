// Серверная функция: создаёт платёж в ЮKassa. Секретные ключи не попадают в браузер.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ref, tier, purpose, listingId } = req.body || {};
  if (!ref) {
    return res.status(400).json({ error: "Некорректные параметры" });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    return res.status(500).json({ error: "Оплата ещё не настроена на сервере" });
  }

  let amountValue, description, metadata;

  if (tier && ["pro", "business"].includes(tier)) {
    const prices = { pro: "199.00", business: "490.00" };
    const labels = { pro: "Подписка PRO на Ярмарке (1 месяц)", business: "Подписка BUSINESS на Ярмарке (1 месяц)" };
    amountValue = prices[tier];
    description = labels[tier];
    metadata = { ref, tier };
  } else if (purpose && listingId) {
    const boostPrices = { boost_top: "79.00", boost_vip: "99.00", boost_promote: "149.00" };
    const boostLabels = { boost_top: "Поднятие в топ (7 дней)", boost_vip: "VIP-бейдж (7 дней)", boost_promote: "Продвижение объявления (3 дня)" };
    if (!boostPrices[purpose]) return res.status(400).json({ error: "Неизвестная услуга" });
    amountValue = boostPrices[purpose];
    description = boostLabels[purpose];
    metadata = { ref, purpose, listingId };
  } else {
    return res.status(400).json({ error: "Некорректные параметры" });
  }

  const idempotenceKey = `${ref}_${tier || purpose}_${Date.now()}`;

  try {
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
        Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
      },
      body: JSON.stringify({
        amount: { value: amountValue, currency: "RUB" },
        confirmation: { type: "redirect", return_url: `${req.headers.origin || ""}/?payment=success` },
        capture: true,
        description,
        metadata,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: data.description || "Ошибка ЮKassa" });
    }
    return res.status(200).json({ confirmation_url: data.confirmation?.confirmation_url, payment_id: data.id });
  } catch (err) {
    return res.status(500).json({ error: "Не удалось создать платёж" });
  }
}
