import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { Loading, ErrorMessage } from "../components/Status.jsx";
import Field from "../components/Field.jsx";
import { formatPrice, formatDay, ORDER_STATUS, PAYMENT_STATUS } from "../utils/pricing.js";
import { addressError, emailError, nameError, passwordError, phoneError } from "../utils/validators.js";
import "./Dashboard.css";

// ---------- Вкладка «Мои заказы» ----------
function Orders() {
  const { data, loading, error, reload } = useFetch("/orders");

  if (loading) return <Loading text="Загружаем ваши заказы…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;
  if (data.length === 0) return <p>Заказов пока нет.</p>;

  return (
    <ul className="orders">
      {data.map((o) => (
        <li key={o.id} className="orders__item">
          <div className="orders__head">
            <b>Заказ №{o.id}</b>
            <span className={`orders__status orders__status--${o.status}`}>{ORDER_STATUS[o.status]}</span>
          </div>
          <p>Доставка: {formatDay(o.deliveryDate)}, {o.address}</p>
          <ul className="orders__items">
            {o.items.map((i, n) => (
              <li key={n}>
                {i.serviceName} × {i.quantity} — {formatPrice(i.unitPrice * i.quantity)}
                {i.discountPercent > 0 && ` (−${i.discountPercent}%)`}
              </li>
            ))}
          </ul>
          <p>
            <b>Итого: {formatPrice(o.total)}</b> · {PAYMENT_STATUS[o.paymentStatus]}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ---------- Вкладка «Личные данные» ----------
function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone || "", address: user.address || "" });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    const found = {
      name: nameError(form.name),
      email: emailError(form.email),
      phone: phoneError(form.phone),
      address: addressError(form.address, false), // адрес по умолчанию необязателен
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      const r = await api("/profile", { method: "PUT", body: form });
      updateUser(r.user);
      setMsg({ ok: true, text: "Данные сохранены." });
    } catch (err) {
      setErrors(err.fields || {});
      setMsg({ ok: false, text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <Field label="Полное имя" value={form.name} onChange={set("name")} error={errors.name} />
      <Field label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
      <Field label="Телефон" type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
      <Field
        label="Адрес по умолчанию"
        value={form.address}
        onChange={set("address")}
        error={errors.address}
        hint="Подставляется при оформлении заказа"
        maxLength={200}
      />
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <button className="btn" disabled={submitting}>{submitting ? "Сохраняем…" : "Сохранить"}</button>
    </form>
  );
}

// ---------- Вкладка «Смена пароля» ----------
function ChangePassword() {
  const empty = { oldPassword: "", newPassword: "", repeat: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    const found = {
      oldPassword: form.oldPassword ? "" : "Введите текущий пароль",
      newPassword: passwordError(form.newPassword),
      repeat: form.repeat !== form.newPassword ? "Пароли не совпадают" : "",
    };
    if (!found.newPassword && form.newPassword === form.oldPassword) {
      found.newPassword = "Новый пароль совпадает со старым";
    }
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      await api("/profile/password", {
        method: "PUT",
        body: { oldPassword: form.oldPassword, newPassword: form.newPassword },
      });
      setForm(empty);
      setMsg({ ok: true, text: "Пароль изменён." });
    } catch (err) {
      setErrors(err.fields || {});
      setMsg({ ok: false, text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <Field label="Текущий пароль" type="password" autoComplete="current-password" value={form.oldPassword} onChange={set("oldPassword")} error={errors.oldPassword} />
      <Field label="Новый пароль" type="password" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} error={errors.newPassword} hint="От 6 до 64 символов" />
      <Field label="Повторите новый пароль" type="password" autoComplete="new-password" value={form.repeat} onChange={set("repeat")} error={errors.repeat} />
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <button className="btn" disabled={submitting}>{submitting ? "Сохраняем…" : "Сменить пароль"}</button>
    </form>
  );
}

// ---------- Личный кабинет ----------
export default function Dashboard() {
  const { user, logout } = useAuth();
  const { totalCount } = useCart();
  const navigate = useNavigate();
  const [tab, setTab] = useState("orders");
  const isAdmin = user.role === "admin";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="dashboard">
      <h1>Личный кабинет</h1>
      <p>Здравствуйте, {user.name}!</p>
      <p>
        {user.email} · {user.phone} · роль: {isAdmin ? "администратор" : "клиент"}
      </p>
      <p>
        {user.coupon
          ? `Ваш купон: «${user.coupon.title}» — скидка ${user.coupon.percent}%`
          : "Персональной скидки пока нет."}
      </p>
      {!isAdmin && <p>Услуг в корзине: {totalCount} шт.</p>}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "orders"} className={tab === "orders" ? "tabs__tab tabs__tab--on" : "tabs__tab"} onClick={() => setTab("orders")}>
          Мои заказы
        </button>
        <button role="tab" aria-selected={tab === "profile"} className={tab === "profile" ? "tabs__tab tabs__tab--on" : "tabs__tab"} onClick={() => setTab("profile")}>
          Личные данные
        </button>
        <button role="tab" aria-selected={tab === "password"} className={tab === "password" ? "tabs__tab tabs__tab--on" : "tabs__tab"} onClick={() => setTab("password")}>
          Смена пароля
        </button>
      </div>

      {tab === "orders" && <Orders />}
      {tab === "profile" && <Profile />}
      {tab === "password" && <ChangePassword />}

      <p style={{ marginTop: 24 }}>
        <button className="btn" onClick={handleLogout}>Выйти</button>
      </p>
    </div>
  );
}
