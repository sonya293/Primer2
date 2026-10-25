// Скидка: применяется бо́льшая из двух — общая скидка на услугу или купон пользователя.
// (Сервер считает по тому же правилу при оформлении заказа.)
export function discountFor(service, coupon) {
  return Math.max(service.discountPercent || 0, coupon?.percent || 0);
}

export function unitPrice(service, coupon) {
  return Math.round((service.price * (100 - discountFor(service, coupon))) / 100);
}

export const formatPrice = (n) => `${n.toLocaleString("ru-RU")} ₽`;

export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
