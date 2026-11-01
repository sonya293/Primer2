import { useState } from "react";
import { Loading, ErrorMessage } from "../Status.jsx";

// Выполняет действие и запоминает результат/ошибку для показа пользователю
export function useAction() {
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
      setMsg({ ok: false, text: e.message, fields: e.fields });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { msg, busy, run, clear: () => setMsg(null) };
}

export function Msg({ msg }) {
  if (!msg) return null;
  return (
    <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>
      {msg.text}
    </p>
  );
}

// Блок админки: заголовок + состояния загрузки/ошибки
export function Section({ title, state, children }) {
  return (
    <section className="admin__section">
      <h2>{title}</h2>
      {state.loading && <Loading />}
      {state.error && <ErrorMessage message={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && children}
    </section>
  );
}

// Кнопка удаления с подтверждением: «Удалить» -> «Точно удалить?» / «Отмена»
export function DeleteButton({ onConfirm, disabled, label = "Удалить" }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button className="btn btn--danger" disabled={disabled} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }
  return (
    <>
      <button
        className="btn btn--danger"
        disabled={disabled}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        Точно удалить?
      </button>{" "}
      <button className="btn btn--ghost" onClick={() => setConfirming(false)}>
        Отмена
      </button>
    </>
  );
}
