export function getTelegram() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : null;
}

export function initTelegram() {
  const tg = getTelegram();
  if (!tg) return null;
  tg.ready();
  tg.expand();
  return tg;
}

export function getTelegramUser() {
  const tg = getTelegram();
  return tg?.initDataUnsafe?.user || null;
}
