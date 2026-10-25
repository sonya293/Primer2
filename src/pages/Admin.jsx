import { useState } from "react";
import { api } from "../api.js";
import { useFetch } from "../hooks/useFetch.js";
import { Loading, ErrorMessage } from "../components/Status.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./Admin.css";

// Небольшой помощник: выполняет действие и показывает результат/ошибку
function useAction() {
  const [msg, setMsg] = useState(null); // { ok: bool, text }
  const [busy, setBusy] = useState(false);

  async function run(fn, okText) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { msg, busy, run };
}

function Msg({ msg }) {
  if (!msg) return null;
  return (
    <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>
      {msg.text}
    </p>
  );
}

function Section({ title, state, children }) {
  return (
    <section className="admin__section">
      <h2>{title}</h2>
      {state.loading && <Loading />}
      {state.error && <ErrorMessage message={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && children}
    </section>
  );
}

// ---------- Категории ----------
function CategoriesAdmin() {
  const categories = useFetch("/categories");
  const services = useFetch("/services");
  const [name, setName] = useState("");
  const { msg, busy, run } = useAction();

  async function add(e) {
    e.preventDefault();
    const ok = await run(
      () => api("/admin/categories", { method: "POST", body: { name } }),
      "Категория добавлена и появится в фильтре каталога.",
    );
    if (ok) {
      setName("");
      categories.reload();
    }
  }

  return (
    <Section title="Категории" state={categories}>
      <ul className="admin__chips">
        {categories.data?.map((c) => (
          <li key={c.id}>
            {c.name}{" "}
            <small>({services.data?.filter((s) => s.categoryId === c.id).length ?? 0})</small>
          </li>
        ))}
      </ul>
      <form className="admin__form" onSubmit={add}>
        <input
          placeholder="Название новой категории"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" disabled={busy}>
          Добавить
        </button>
      </form>
      <Msg msg={msg} />
    </Section>
  );
}

// ---------- Услуги и общие скидки ----------
function ServiceRow({ service, onSaved }) {
  const [percent, setPercent] = useState(String(service.discountPercent));
  const { msg, busy, run } = useAction();

  async function save() {
    const ok = await run(
      () => api(`/admin/services/${service.id}/discount`, { method: "PUT", body: { percent } }),
      "Сохранено",
    );
    if (ok) onSaved();
  }

  return (
    <tr>
      <td>{service.name}</td>
      <td>{service.categoryName}</td>
      <td>{service.price} ₽</td>
      <td>
        <input
          className="admin__num"
          type="number"
          min="0"
          max="90"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
        />{" "}
        %
      </td>
      <td>
        <button className="btn" disabled={busy} onClick={save}>
          Сохранить
        </button>{" "}
        {msg && <small className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</small>}
      </td>
    </tr>
  );
}

function ServicesAdmin() {
  const services = useFetch("/services");
  const categories = useFetch("/categories");
  const empty = { categoryId: "", name: "", description: "", durationMin: "", price: "", discountPercent: "" };
  const [form, setForm] = useState(empty);
  const { msg, busy, run } = useAction();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function add(e) {
    e.preventDefault();
    const ok = await run(
      () => api("/admin/services", { method: "POST", body: form }),
      "Услуга добавлена.",
    );
    if (ok) {
      setForm(empty);
      services.reload();
    }
  }

  const discounted = services.data?.filter((s) => s.discountPercent > 0).length ?? 0;

  return (
    <Section title="Услуги и общие скидки" state={services}>
      <p>
        Со скидкой: {discounted} из {services.data?.length ?? 0} услуг.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Услуга</th>
              <th>Категория</th>
              <th>Цена</th>
              <th>Общая скидка</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {services.data?.map((s) => (
              <ServiceRow key={s.id} service={s} onSaved={services.reload} />
            ))}
          </tbody>
        </table>
      </div>

      <h3>Новая услуга</h3>
      <form className="admin__form admin__form--grid" onSubmit={add}>
        <input placeholder="Название" value={form.name} onChange={set("name")} />
        <select value={form.categoryId} onChange={set("categoryId")}>
          <option value="">Категория…</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input placeholder="Описание" value={form.description} onChange={set("description")} />
        <input type="number" min="1" placeholder="Минут" value={form.durationMin} onChange={set("durationMin")} />
        <input type="number" min="0" placeholder="Цена, ₽" value={form.price} onChange={set("price")} />
        <input type="number" min="0" max="90" placeholder="Скидка, %" value={form.discountPercent} onChange={set("discountPercent")} />
        <button className="btn" disabled={busy}>
          Добавить услугу
        </button>
      </form>
      <Msg msg={msg} />
    </Section>
  );
}

// ---------- Купоны и персональные скидки ----------
function CouponsAdmin({ coupons }) {
  const [title, setTitle] = useState("");
  const [percent, setPercent] = useState("");
  const { msg, busy, run } = useAction();

  async function add(e) {
    e.preventDefault();
    const ok = await run(
      () => api("/admin/coupons", { method: "POST", body: { title, percent } }),
      "Вид купона добавлен.",
    );
    if (ok) {
      setTitle("");
      setPercent("");
      coupons.reload();
    }
  }

  return (
    <>
      <ul className="admin__chips">
        {coupons.data?.map((c) => (
          <li key={c.id}>
            {c.title} — {c.percent}%
          </li>
        ))}
      </ul>
      <form className="admin__form" onSubmit={add}>
        <input placeholder="Название купона" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="number" min="1" max="90" placeholder="Скидка, %" value={percent} onChange={(e) => setPercent(e.target.value)} />
        <button className="btn" disabled={busy}>
          Создать купон
        </button>
      </form>
      <Msg msg={msg} />
    </>
  );
}

function UserRow({ u, coupons, isSelf }) {
  const { refresh } = useAuth();
  const [couponId, setCouponId] = useState(u.coupon ? String(u.coupon.id) : "");
  const { msg, busy, run } = useAction();

  async function change(e) {
    const value = e.target.value;
    setCouponId(value);
    const ok = await run(
      () => api(`/admin/users/${u.id}/coupon`, { method: "PUT", body: { couponId: value || null } }),
      value ? "Купон выдан" : "Купон снят",
    );
    if (ok && isSelf) refresh();
  }

  return (
    <tr>
      <td>{u.name}</td>
      <td>{u.email}</td>
      <td>{u.role === "admin" ? "админ" : "клиент"}</td>
      <td>
        <select value={couponId} onChange={change} disabled={busy}>
          <option value="">Без купона</option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} (−{c.percent}%)
            </option>
          ))}
        </select>{" "}
        {msg && <small className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</small>}
      </td>
    </tr>
  );
}

function UsersAdmin() {
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
    <Section title="Купоны и персональные скидки" state={state}>
      <CouponsAdmin coupons={coupons} />
      <h3>Пользователи</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Персональный купон</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <UserRow key={u.id} u={u} coupons={coupons.data || []} isSelf={u.id === user.id} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export default function Admin() {
  return (
    <div className="admin">
      <h1>Администрирование</h1>
      <CategoriesAdmin />
      <ServicesAdmin />
      <UsersAdmin />
    </div>
  );
}
