import { useState } from "react";
import { api } from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Field from "../Field.jsx";
import { emailError, nameError, phoneError, addressError, intError } from "../../utils/validators.js";
import { useAction, Msg, Section, DeleteButton } from "./common.jsx";

// ---------- Купоны ----------
function CouponRow({ coupon, onChanged }) {
  const [title, setTitle] = useState(coupon.title);
  const [percent, setPercent] = useState(String(coupon.percent));
  const [err, setErr] = useState("");
  const { msg, busy, run } = useAction();

  async function save() {
    const e =
      title.trim().length < 2 || title.trim().length > 30
        ? "Название — от 2 до 30 символов"
        : intError(percent, { min: 1, max: 90, label: "Скидка" });
    setErr(e);
    if (e) return;
    if (await run(() => api(`/admin/coupons/${coupon.id}`, { method: "PUT", body: { title, percent } }), "Сохранено")) onChanged();
  }
  async function remove() {
    if (await run(() => api(`/admin/coupons/${coupon.id}`, { method: "DELETE" }), "Удалён")) onChanged();
  }

  return (
    <tr>
      <td>{coupon.code}</td>
      <td><input value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} /></td>
      <td><input className="admin__num" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} /> %</td>
      <td>
        <button className="btn" disabled={busy} onClick={save}>Сохранить</button>{" "}
        <DeleteButton disabled={busy} onConfirm={remove} />
        {err && <div className="form-error">{err}</div>}
        {msg && <small className={msg.ok ? "form-ok" : "form-error"}> {msg.text}</small>}
      </td>
    </tr>
  );
}

function CouponsAdmin({ coupons, onChanged }) {
  const [title, setTitle] = useState("");
  const [percent, setPercent] = useState("");
  const [err, setErr] = useState("");
  const { msg, busy, run } = useAction();

  async function add(e) {
    e.preventDefault();
    const found =
      title.trim().length < 2 || title.trim().length > 30
        ? "Название — от 2 до 30 символов"
        : intError(percent, { min: 1, max: 90, label: "Скидка" });
    setErr(found);
    if (found) return;
    if (await run(() => api("/admin/coupons", { method: "POST", body: { title, percent } }), "Купон добавлен.")) {
      setTitle("");
      setPercent("");
      onChanged();
    }
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Код</th><th>Название</th><th>Скидка</th><th /></tr></thead>
          <tbody>{coupons.map((c) => <CouponRow key={c.id} coupon={c} onChanged={onChanged} />)}</tbody>
        </table>
      </div>
      <h3>Новый купон</h3>
      <form className="admin__form" onSubmit={add} noValidate>
        <input placeholder="Название купона" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} />
        <input inputMode="numeric" placeholder="Скидка, %" value={percent} onChange={(e) => setPercent(e.target.value)} />
        <button className="btn" disabled={busy}>Создать купон</button>
      </form>
      {err && <p className="form-error">{err}</p>}
      <Msg msg={msg} />
    </>
  );
}

// ---------- Пользователи ----------
function UserRow({ u, coupons, isSelf, onChanged }) {
  const { refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: u.name, email: u.email, phone: u.phone || "", address: u.address || "" });
  const [errors, setErrors] = useState({});
  const { msg, busy, run } = useAction();
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function changeCoupon(e) {
    const value = e.target.value;
    const ok = await run(
      () => api(`/admin/users/${u.id}/coupon`, { method: "PUT", body: { couponId: value || null } }),
      value ? "Купон выдан" : "Купон снят",
    );
    if (ok) {
      onChanged();
      if (isSelf) refresh();
    }
  }

  async function save(e) {
    e.preventDefault();
    const found = {
      name: nameError(form.name),
      email: emailError(form.email),
      phone: phoneError(form.phone),
      address: addressError(form.address, false),
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    if (await run(() => api(`/admin/users/${u.id}`, { method: "PUT", body: form }), "Сохранено")) {
      setEditing(false);
      onChanged();
      if (isSelf) refresh();
    }
  }

  async function remove() {
    if (await run(() => api(`/admin/users/${u.id}`, { method: "DELETE" }), "Удалён")) onChanged();
  }

  return (
    <>
      <tr>
        <td>{u.name}</td>
        <td>{u.email}</td>
        <td>{u.phone}</td>
        <td>{u.role === "admin" ? "админ" : "клиент"}</td>
        <td>
          <select value={u.coupon ? String(u.coupon.id) : ""} onChange={changeCoupon} disabled={busy}>
            <option value="">Без купона</option>
            {coupons.map((c) => <option key={c.id} value={c.id}>{c.title} (−{c.percent}%)</option>)}
          </select>
        </td>
        <td>
          <button className="btn" onClick={() => setEditing(!editing)}>{editing ? "Закрыть" : "Изменить"}</button>{" "}
          {!isSelf && <DeleteButton disabled={busy} onConfirm={remove} />}{" "}
          {msg && <small className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</small>}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6}>
            <form className="admin__service-form" onSubmit={save} noValidate>
              <Field label="Имя" value={form.name} onChange={set("name")} error={errors.name || msg?.fields?.name} />
              <Field label="Email" value={form.email} onChange={set("email")} error={errors.email || msg?.fields?.email} />
              <Field label="Телефон" value={form.phone} onChange={set("phone")} error={errors.phone || msg?.fields?.phone} />
              <Field label="Адрес" value={form.address} onChange={set("address")} error={errors.address || msg?.fields?.address} />
              <div className="admin__service-actions"><button className="btn" disabled={busy}>Сохранить</button></div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

export default function UsersAdmin() {
  const { user } = useAuth();
  const users = useFetch("/admin/users");
  const coupons = useFetch("/admin/coupons");
  const state = {
    loading: users.loading || coupons.loading,
    error: users.error || coupons.error,
    reload: () => {
      users.reload();
      coupons.reload();
    },
  };

  return (
    <Section title="Купоны и пользователи" state={state}>
      <CouponsAdmin coupons={coupons.data || []} onChanged={state.reload} />
      <h3>Пользователи</h3>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Имя</th><th>Email</th><th>Телефон</th><th>Роль</th><th>Персональный купон</th><th /></tr></thead>
          <tbody>
            {users.data?.map((u) => (
              <UserRow key={u.id} u={u} coupons={coupons.data || []} isSelf={u.id === user.id} onChanged={state.reload} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
