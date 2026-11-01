import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { Loading, ErrorMessage } from "../components/Status.jsx";
import Field from "../components/Field.jsx";
import { formatPrice, formatDuration, formatDay } from "../utils/pricing.js";
import { addressError, deliveryDateError, todayStr } from "../utils/validators.js";
import "./Cart.css";

// Страница корзины. Данные корзины лежат в БД и приходят с сервера (CartContext).
export default function Cart() {
  const { user } = useAuth();
  const { cart, loading, error, busy, reload, setQuantity, removeFromCart, clearCart, resetCart } = useCart();

  const [address, setAddress] = useState(user?.address || ""); // подставляем адрес по умолчанию
  const [deliveryDate, setDeliveryDate] = useState("");
  const [method, setMethod] = useState("card");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  // Любое изменение корзины: ошибку показываем над списком
  async function run(fn) {
    setActionError("");
    try {
      await fn();
    } catch (e) {
      setActionError(e.message);
    }
  }

  if (!user) {
    return (
      <div>
        <h1>Корзина</h1>
        <p>Корзина хранится в вашем аккаунте. Чтобы пользоваться ею, войдите или зарегистрируйтесь.</p>
        <p className="cart__back">
          <Link to="/login" state={{ from: "/cart" }}>Войти</Link> · <Link to="/register">Регистрация</Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <h1>Заказ оформлен</h1>
        <p className="status status--ok">
          Заказ №{done.orderId} принят. Позиций: {done.positions}. Сумма: {formatPrice(done.total)} —{" "}
          {done.paymentStatus === "paid" ? "оплачено картой" : "оплата при получении"}.
        </p>
        <p className="cart__back">
          <Link to="/dashboard">Перейти в личный кабинет</Link> · <Link to="/">Вернуться в каталог</Link>
        </p>
      </div>
    );
  }

  if (loading) return <Loading text="Загружаем корзину…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  if (cart.items.length === 0) {
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

  async function handleCheckout(e) {
    e.preventDefault();
    setFormError("");
    const found = {
      address: addressError(address),
      deliveryDate: deliveryDateError(deliveryDate),
    };
    setErrors(found);
    if (found.address || found.deliveryDate) return;

    setSubmitting(true);
    try {
      const result = await api("/orders", {
        method: "POST",
        body: { address: address.trim(), deliveryDate, method },
      });
      resetCart();
      setDone(result);
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Корзина</h1>
      {actionError && <p className="status status--error" role="alert">{actionError}</p>}

      <ul className="cart__list">
        {cart.items.map((l) => (
          <li key={l.serviceId} className="cart__row">
            <span className="cart__name">
              {l.name}
              <span className="cart__unit">
                {" "}
                — {formatDuration(l.durationMin)}, {formatPrice(l.unitPrice)} за шт.
                {l.percent > 0 && ` (скидка ${l.percent}%)`}
              </span>
            </span>

            <div className="cart__qty">
              <button className="cart__qty-btn" onClick={() => run(() => setQuantity(l.serviceId, l.quantity - 1))} disabled={busy || l.quantity === 1} aria-label="Уменьшить количество">−</button>
              <span className="cart__qty-value">{l.quantity}</span>
              <button className="cart__qty-btn" onClick={() => run(() => setQuantity(l.serviceId, l.quantity + 1))} disabled={busy || l.quantity >= 20} aria-label="Увеличить количество">+</button>
            </div>

            <span className="cart__price">{formatPrice(l.lineTotal)}</span>
            <button className="btn btn--danger" disabled={busy} onClick={() => run(() => removeFromCart(l.serviceId))}>
              Удалить
            </button>
          </li>
        ))}
      </ul>

      {cart.fullTotal > cart.total && <p className="cart__saved">Скидка: −{formatPrice(cart.fullTotal - cart.total)}</p>}
      <p className="cart__total">Итого: {formatPrice(cart.total)}</p>

      <form className="form" onSubmit={handleCheckout} noValidate>
        <h2>Оформление заказа</h2>
        <Field
          label="Адрес доставки"
          autoComplete="street-address"
          placeholder="Город, улица, дом, квартира"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          error={errors.address}
          maxLength={200}
        />
        <Field
          label="Дата доставки"
          type="date"
          min={todayStr()}
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          error={errors.deliveryDate}
        />
        <Field label="Способ оплаты" as="select" value={method} onChange={(e) => setMethod(e.target.value)} error={errors.method}>
          <option value="card">Картой онлайн</option>
          <option value="cash">При получении</option>
        </Field>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn" type="submit" disabled={submitting || busy}>
          {submitting ? "Оформляем…" : "Оформить заказ"}
        </button>
        {deliveryDate && !errors.deliveryDate && <p className="login__hint">Доставка: {formatDay(deliveryDate)}</p>}
      </form>

      <p style={{ marginTop: 16 }}>
        <button className="btn btn--ghost" disabled={busy} onClick={() => run(clearCart)}>
          Очистить корзину
        </button>
      </p>
    </div>
  );
}
