import { useState } from "react";
import { api } from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import Field from "../Field.jsx";
import { serviceFormErrors } from "../../utils/validators.js";
import { formatPrice } from "../../utils/pricing.js";
import { useAction, Msg, Section, DeleteButton } from "./common.jsx";

const EMPTY = { categoryId: "", name: "", description: "", durationMin: "", price: "", discountPercent: "", image: "" };

// Форма услуги (и для добавления, и для редактирования) с проверкой полей до отправки
function ServiceForm({ initial, categories, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const { msg, busy, run } = useAction();
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const found = serviceFormErrors(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const ok = await run(() => onSubmit(form), "Сохранено");
    if (ok && initial === EMPTY) setForm(EMPTY);
  }

  // Ошибки полей, пришедшие с сервера, показываем рядом с полями
  const err = (key) => errors[key] || (msg && !msg.ok && msg.fields?.[key]) || "";

  return (
    <form className="admin__service-form" onSubmit={handleSubmit} noValidate>
      <Field label="Название" value={form.name} onChange={set("name")} error={err("name")} maxLength={100} />
      <Field label="Категория" as="select" value={form.categoryId} onChange={set("categoryId")} error={err("categoryId")}>
        <option value="">Выберите…</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Field>
      <Field label="Описание" value={form.description} onChange={set("description")} error={err("description")} maxLength={500} />
      <Field label="Минут" inputMode="numeric" value={form.durationMin} onChange={set("durationMin")} error={err("durationMin")} />
      <Field label="Цена, ₽" inputMode="numeric" value={form.price} onChange={set("price")} error={err("price")} />
      <Field label="Скидка, %" inputMode="numeric" value={form.discountPercent} onChange={set("discountPercent")} error={err("discountPercent")} />
      <Field label="Картинка (необязательно)" placeholder="/images/services/name.jpg" value={form.image} onChange={set("image")} error={err("image")} />
      <div className="admin__service-actions">
        <button className="btn" disabled={busy}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Отмена</button>}
        {msg && !msg.fields && <Msg msg={msg} />}
        {msg && !msg.ok && msg.fields && <p className="form-error">{msg.text}</p>}
      </div>
    </form>
  );
}

// Строка таблицы: просмотр + редактирование всех полей + удаление
function ServiceRow({ service, categories, onChanged }) {
  const [editing, setEditing] = useState(false);
  const { msg, busy, run } = useAction();

  async function remove() {
    if (await run(() => api(`/admin/services/${service.id}`, { method: "DELETE" }), "Удалено")) onChanged();
  }

  const initial = {
    categoryId: String(service.categoryId),
    name: service.name,
    description: service.description,
    durationMin: String(service.durationMin),
    price: String(service.price),
    discountPercent: String(service.discountPercent),
    image: service.image || "",
  };

  return (
    <>
      <tr>
        <td>{service.name}</td>
        <td>{service.categoryName}</td>
        <td>{formatPrice(service.price)}</td>
        <td>{service.discountPercent}%</td>
        <td>
          <button className="btn" onClick={() => setEditing(!editing)}>{editing ? "Закрыть" : "Изменить"}</button>{" "}
          <DeleteButton disabled={busy} onConfirm={remove} />{" "}
          {msg && <small className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</small>}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5}>
            <ServiceForm
              initial={initial}
              categories={categories}
              submitLabel="Сохранить изменения"
              onCancel={() => setEditing(false)}
              onSubmit={async (form) => {
                await api(`/admin/services/${service.id}`, { method: "PUT", body: form });
                onChanged();
                setEditing(false);
              }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export default function ServicesAdmin() {
  const services = useFetch("/services");
  const categories = useFetch("/categories");
  const state = {
    loading: services.loading || categories.loading,
    error: services.error || categories.error,
    reload: () => {
      services.reload();
      categories.reload();
    },
  };
  const discounted = services.data?.filter((s) => s.discountPercent > 0).length ?? 0;

  return (
    <Section title="Услуги и скидки" state={state}>
      <p>Со скидкой: {discounted} из {services.data?.length ?? 0} услуг.</p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Услуга</th><th>Категория</th><th>Цена</th><th>Скидка</th><th /></tr>
          </thead>
          <tbody>
            {services.data?.map((s) => (
              <ServiceRow key={s.id} service={s} categories={categories.data || []} onChanged={services.reload} />
            ))}
          </tbody>
        </table>
      </div>

      <h3>Новая услуга</h3>
      <ServiceForm
        initial={EMPTY}
        categories={categories.data || []}
        submitLabel="Добавить услугу"
        onSubmit={async (form) => {
          await api("/admin/services", { method: "POST", body: form });
          services.reload();
        }}
      />
    </Section>
  );
}
