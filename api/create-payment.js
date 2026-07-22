export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ref, tier } = req.body || {};
  if (!ref || !["pro", "business"].includes(tier)) {
    return res.status(400).json({ error: "Некорректные параметры" });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    return res.status(500).json({ error: "Оплата ещё не настроена на сервере" });
  }

  const prices = { pro: "299.00", business: "990.00" };
  const labels = { pro: "Подписка PRO на Ярмарке (1 месяц)", business: "Подписка BUSINESS на Ярмарке (1 месяц)" };

  const idempotenceKey = `${ref}_${tier}_${Date.now()}`;

  try {
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
        Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
      },
      body: JSON.stringify({
        amount: { value: prices[tier], currency: "RUB" },
        confirmation: { type: "redirect", return_url: `${req.headers.origin || ""}/?payment=success` },
        capture: true,
        description: labels[tier],
        metadata: { ref, tier },
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
