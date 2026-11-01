import { useState } from "react";
import { api } from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import { useAction, Msg, Section, DeleteButton } from "./common.jsx";

const nameErr = (v) => (v.trim().length < 2 || v.trim().length > 40 ? "Название — от 2 до 40 символов" : "");

// Одна категория: переименование и удаление
function CategoryRow({ category, count, onChanged }) {
  const [name, setName] = useState(category.name);
  const [err, setErr] = useState("");
  const { msg, busy, run } = useAction();

  async function save() {
    const e = nameErr(name);
    setErr(e);
    if (e) return;
    if (await run(() => api(`/admin/categories/${category.id}`, { method: "PUT", body: { name } }), "Сохранено")) onChanged();
  }
  async function remove() {
    if (await run(() => api(`/admin/categories/${category.id}`, { method: "DELETE" }), "Удалено")) onChanged();
  }

  return (
    <tr>
      <td>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(err)} />
        {err && <div className="form-error">{err}</div>}
      </td>
      <td>{count}</td>
      <td>
        <button className="btn" disabled={busy || name === category.name} onClick={save}>Сохранить</button>{" "}
        <DeleteButton disabled={busy} onConfirm={remove} />{" "}
        {msg && <small className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</small>}
      </td>
    </tr>
  );
}

export default function CategoriesAdmin() {
  const categories = useFetch("/categories");
  const services = useFetch("/services");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const { msg, busy, run } = useAction();

  async function add(e) {
    e.preventDefault();
    const found = nameErr(name);
    setErr(found);
    if (found) return;
    if (await run(() => api("/admin/categories", { method: "POST", body: { name } }), "Категория добавлена.")) {
      setName("");
      categories.reload();
    }
  }

  const reloadAll = () => {
    categories.reload();
    services.reload();
  };

  return (
    <Section title="Категории" state={categories}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Название</th><th>Услуг</th><th /></tr>
          </thead>
          <tbody>
            {categories.data?.map((c) => (
              <CategoryRow key={c.id} category={c} count={services.data?.filter((s) => s.categoryId === c.id).length ?? 0} onChanged={reloadAll} />
            ))}
          </tbody>
        </table>
      </div>
      <h3>Новая категория</h3>
      <form className="admin__form" onSubmit={add} noValidate>
        <input placeholder="Название новой категории" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(err)} />
        <button className="btn" disabled={busy}>Добавить</button>
      </form>
      {err && <p className="form-error">{err}</p>}
      <Msg msg={msg} />
    </Section>
  );
}
