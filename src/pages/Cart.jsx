import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { api } from "../api.js";
import { Loading, ErrorMessage } from "../components/Status.jsx";
import { discountFor, unitPrice, formatPrice, formatDuration } from "../utils/pricing.js";
import "./Cart.css";

export default function Cart() {
  const { items, increaseQty, decreaseQty, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const services = useFetch("/services");

  const [scheduledAt, setScheduledAt] = useState("");
  const [method, setMethod] = useState("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  if (done) {
    return (
      <div>
        <h1>Запись оформлена</h1>
        <p className="status status--ok">
          Создано записей: {done.appointments}. Сумма: {formatPrice(done.total)} —{" "}
          {done.paymentStatus === "paid" ? "оплачено картой" : "оплата на месте"}.
        </p>
        <p className="cart__back">
          <Link to="/dashboard">Перейти в личный кабинет</Link>
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <h1>Корзина</h1>
        <p>Корзина пуста.</p>
        <p className="cart__back">
          <Link to="/">Перейти в каталог</Link>
        </p>
      </div>
    );
  }

  if (services.loading) return <Loading text="Загружаем корзину…" />;
  if (services.error) return <ErrorMessage message={services.error} onRetry={services.reload} />;

  // Склеиваем позиции корзины (id + qty) с актуальными данными услуг из API
  const byId = new Map(services.data.map((s) => [s.id, s]));
  const lines = items
    .filter((item) => byId.has(item.id))
    .map((item) => {
      const service = byId.get(item.id);
      return {
        service,
        qty: item.qty,
        price: unitPrice(service, user?.coupon),
        percent: discountFor(service, user?.coupon),
      };
    });

  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const fullTotal = lines.reduce((sum, l) => sum + l.service.price * l.qty, 0);

  async function handleCheckout(e) {
    e.preventDefault();
    setError("");
    if (!scheduledAt) {
      setError("Укажите дату и время записи");
      return;
    }
    if (new Date(scheduledAt) < new Date()) {
      setError("Дата записи должна быть в будущем");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api("/checkout", {
        method: "POST",
        body: {
          items: lines.map((l) => ({ serviceId: l.service.id, qty: l.qty })),
          scheduledAt: new Date(scheduledAt).toISOString(),
          method,
        },
      });
      clearCart();
      setDone(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Корзина</h1>

      <ul className="cart__list">
        {lines.map(({ service, qty, price, percent }) => (
          <li key={service.id} className="cart__row">
            <span className="cart__name">
              {service.name}
              <span className="cart__unit">
                {" "}
                — {formatDuration(service.durationMin)}, {formatPrice(price)} за шт.
                {percent > 0 && ` (скидка ${percent}%)`}
              </span>
            </span>

            <div className="cart__qty">
              <button
                className="cart__qty-btn"
                onClick={() => decreaseQty(service.id)}
                disabled={qty === 1}
                aria-label="Уменьшить количество"
              >
                −
              </button>
              <span className="cart__qty-value">{qty}</span>
              <button
                className="cart__qty-btn"
                onClick={() => increaseQty(service.id)}
                aria-label="Увеличить количество"
              >
                +
              </button>
            </div>

            <span className="cart__price">{formatPrice(price * qty)}</span>
            <button className="btn btn--danger" onClick={() => removeFromCart(service.id)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>

      {fullTotal > total && (
        <p className="cart__saved">Скидка: −{formatPrice(fullTotal - total)}</p>
      )}
      <p className="cart__total">Итого: {formatPrice(total)}</p>

      {user ? (
        <form className="checkout" onSubmit={handleCheckout}>
          <label>
            Дата и время записи
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <label>
            Способ оплаты
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="card">Картой онлайн</option>
              <option value="cash">На месте</option>
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Оформляем…" : "Оформить запись"}
          </button>
        </form>
      ) : (
        <p className="cart__back">
          Чтобы оформить запись, <Link to="/login">войдите в аккаунт</Link>.
        </p>
      )}

      <p style={{ marginTop: 16 }}>
        <button className="btn btn--ghost" onClick={clearCart}>
          Очистить корзину
        </button>
      </p>
    </div>
  );
}
